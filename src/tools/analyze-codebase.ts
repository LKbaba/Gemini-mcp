/**
 * Tool 6: gemini_analyze_codebase
 * 代码库分析工具 - 利用 1M token 上下文分析整个代码库
 * Priority: P1 - Phase 3
 *
 * 升级说明（v1.1）:
 * - 新增 directory 参数：支持直接传入目录路径
 * - 新增 filePaths 参数：支持传入文件路径列表
 * - 新增 include/exclude 参数：支持 glob 模式过滤
 * - 保留 files 参数：向后兼容原有调用方式
 */

import { GeminiClient } from '../utils/gemini-client.js';
import {
  validateRequired,
  validateArray
} from '../utils/validators.js';
import { handleAPIError, logError } from '../utils/error-handler.js';
import {
  readDirectory,
  readFiles,
  FileContent
} from '../utils/file-reader.js';
import { SecurityError } from '../utils/security.js';

// 代码库分析系统提示词
const CODEBASE_ANALYSIS_SYSTEM_PROMPT = `You are a senior software architect with expertise in:
- System architecture and design patterns
- Code quality and best practices
- Security vulnerabilities and threats
- Performance optimization
- Dependency management

Analysis approach:
1. Overview:
   - Understand the overall structure
   - Identify main components and their relationships
   - Recognize architectural patterns

2. Deep dive (based on focus):
   - Architecture: Layers, modules, data flow
   - Security: Vulnerabilities, exposure points
   - Performance: Bottlenecks, inefficiencies
   - Dependencies: Version conflicts, outdated packages
   - Patterns: Design patterns, anti-patterns

3. Recommendations:
   - Prioritize by impact and effort
   - Provide actionable suggestions
   - Include code examples when helpful

Output quality:
- Be thorough but concise
- Use clear, professional language
- Include file paths and line numbers
- Visualize architecture with Mermaid diagrams
- Focus on high-impact findings`;

// 参数接口
export interface AnalyzeCodebaseParams {
  // ===== 输入方式（三选一）=====

  /**
   * 方式1：目录路径【新增】
   * 直接传入目录路径，工具会自动读取目录下的文件
   */
  directory?: string;

  /**
   * glob 包含模式，仅与 directory 参数配合使用
   * 例如: ["**\/*.ts", "**\/*.tsx"]
   */
  include?: string[];

  /**
   * glob 排除模式，仅与 directory 参数配合使用
   * 例如: ["node_modules/**", "**\/*.test.ts"]
   */
  exclude?: string[];

  /**
   * 方式2：文件路径列表【新增】
   * 传入文件路径列表，工具会自动读取这些文件
   */
  filePaths?: string[];

  /**
   * 方式3：文件内容数组【保留，向后兼容】
   * 直接传入文件内容，无需工具读取
   */
  files?: Array<{
    path: string;
    content: string;
  }>;

  // ===== 其他参数（保持不变）=====
  focus?: 'architecture' | 'security' | 'performance' | 'dependencies' | 'patterns';
  deepThink?: boolean;
  outputFormat?: 'markdown' | 'json';
}

// 返回接口
export interface AnalyzeCodebaseResult {
  summary: string;
  findings: Array<{
    category: string;
    severity: 'high' | 'medium' | 'low';
    description: string;
    location?: string;
    suggestion?: string;
  }>;
  metrics?: {
    totalFiles: number;
    totalLines: number;
    languages: string[];
    complexity?: string;
  };
  visualization?: string;
  analysisDepth: string;
}

/**
 * 检测文件的编程语言
 */
function detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    'ts': 'TypeScript',
    'tsx': 'TypeScript (React)',
    'js': 'JavaScript',
    'jsx': 'JavaScript (React)',
    'py': 'Python',
    'java': 'Java',
    'kt': 'Kotlin',
    'go': 'Go',
    'rs': 'Rust',
    'cpp': 'C++',
    'c': 'C',
    'h': 'C/C++ Header',
    'hpp': 'C++ Header',
    'cs': 'C#',
    'rb': 'Ruby',
    'php': 'PHP',
    'swift': 'Swift',
    'scala': 'Scala',
    'vue': 'Vue',
    'svelte': 'Svelte',
    'html': 'HTML',
    'css': 'CSS',
    'scss': 'SCSS',
    'less': 'LESS',
    'json': 'JSON',
    'yaml': 'YAML',
    'yml': 'YAML',
    'xml': 'XML',
    'md': 'Markdown',
    'sql': 'SQL',
    'sh': 'Shell',
    'bash': 'Bash',
    'ps1': 'PowerShell',
    'dockerfile': 'Dockerfile',
  };
  return languageMap[ext] || 'Unknown';
}

/**
 * 构建代码库分析提示词
 */
function buildCodebasePrompt(
  params: AnalyzeCodebaseParams,
  metrics: { totalFiles: number; totalLines: number; languages: string[] },
  outputFormat: string
): string {
  let prompt = `# Codebase Analysis Request\n\n`;

  prompt += `## Codebase Overview\n`;
  prompt += `- Total Files: ${metrics.totalFiles}\n`;
  prompt += `- Total Lines: ${metrics.totalLines}\n`;
  prompt += `- Languages: ${metrics.languages.join(', ')}\n\n`;

  if (params.focus) {
    prompt += `## Analysis Focus\n`;
    switch (params.focus) {
      case 'architecture':
        prompt += `Focus on system architecture:
- Identify architectural patterns (MVC, MVVM, Clean Architecture, etc.)
- Analyze module/component structure
- Map data flow and dependencies
- Identify layers and boundaries
- Create architecture diagram using Mermaid\n\n`;
        break;
      case 'security':
        prompt += `Focus on security analysis:
- Identify potential vulnerabilities (OWASP Top 10)
- Check for hardcoded secrets/credentials
- Analyze authentication/authorization patterns
- Review input validation and sanitization
- Check for SQL injection, XSS, CSRF vulnerabilities\n\n`;
        break;
      case 'performance':
        prompt += `Focus on performance analysis:
- Identify potential bottlenecks
- Check for N+1 queries, memory leaks
- Analyze async/await patterns
- Review caching strategies
- Check for inefficient algorithms\n\n`;
        break;
      case 'dependencies':
        prompt += `Focus on dependency analysis:
- Check for outdated dependencies
- Identify unused dependencies
- Look for version conflicts
- Review dependency tree
- Check for known vulnerabilities in dependencies\n\n`;
        break;
      case 'patterns':
        prompt += `Focus on design patterns:
- Identify design patterns used
- Look for anti-patterns
- Check for code smells
- Review naming conventions
- Analyze code organization\n\n`;
        break;
    }
  } else {
    prompt += `## Analysis Focus\nPerform a comprehensive analysis covering architecture, security, performance, and code quality.\n\n`;
  }

  if (params.deepThink) {
    prompt += `## Deep Think Mode\nPerform an extra thorough analysis. Take your time to reason through complex issues. Consider edge cases and subtle problems.\n\n`;
  }

  prompt += `## Output Format\n`;
  if (outputFormat === 'json') {
    prompt += `Provide your response as valid JSON with the following structure:
{
  "summary": "Overall summary of the codebase",
  "findings": [
    {
      "category": "security|performance|architecture|patterns|dependencies",
      "severity": "high|medium|low",
      "description": "Description of the finding",
      "location": "file path and line numbers if applicable",
      "suggestion": "Recommended fix or improvement"
    }
  ],
  "visualization": "Mermaid diagram code for architecture visualization"
}\n\n`;
  } else {
    prompt += `Use Markdown formatting:
- Start with an executive summary
- Group findings by category
- Use severity badges: 🔴 High, 🟡 Medium, 🟢 Low
- Include code snippets for examples
- Add a Mermaid diagram for architecture visualization\n\n`;
  }

  prompt += `## Files to Analyze\n\n`;

  // 添加所有文件内容（此处 params.files 在调用前已确保有值）
  for (const file of params.files!) {
    const language = detectLanguage(file.path);
    prompt += `### ${file.path} (${language})\n`;
    prompt += `\`\`\`${language.toLowerCase().split(' ')[0]}\n`;
    prompt += file.content;
    prompt += `\n\`\`\`\n\n`;
  }

  return prompt;
}

/**
 * 将 FileContent 数组转换为内部文件格式
 */
function convertFileContents(
  fileContents: FileContent[]
): Array<{ path: string; content: string }> {
  return fileContents.map(fc => ({
    path: fc.path,
    content: fc.content
  }));
}

/**
 * 处理 gemini_analyze_codebase 工具调用
 *
 * 支持三种输入方式（优先级：directory > filePaths > files）：
 * 1. directory: 传入目录路径，自动读取目录下的文件
 * 2. filePaths: 传入文件路径列表，自动读取这些文件
 * 3. files: 直接传入文件内容数组（向后兼容）
 */
export async function handleAnalyzeCodebase(
  params: AnalyzeCodebaseParams,
  client: GeminiClient
): Promise<AnalyzeCodebaseResult> {
  try {
    // ===== 1. 参数验证 =====
    const hasDirectory = !!params.directory;
    const hasFilePaths = params.filePaths && params.filePaths.length > 0;
    const hasFiles = params.files && params.files.length > 0;

    // 验证至少提供一种输入方式
    if (!hasDirectory && !hasFilePaths && !hasFiles) {
      throw new Error(
        '必须提供 directory、filePaths 或 files 参数之一。' +
        '请使用 directory 传入目录路径，filePaths 传入文件路径列表，或 files 传入文件内容数组。'
      );
    }

    // 验证可选枚举参数
    const validFocusAreas = ['architecture', 'security', 'performance', 'dependencies', 'patterns'];
    const validFormats = ['markdown', 'json'];

    if (params.focus && !validFocusAreas.includes(params.focus)) {
      throw new Error(`Invalid focus: ${params.focus}. Must be one of: ${validFocusAreas.join(', ')}`);
    }
    if (params.outputFormat && !validFormats.includes(params.outputFormat)) {
      throw new Error(`Invalid outputFormat: ${params.outputFormat}. Must be one of: ${validFormats.join(', ')}`);
    }

    // ===== 2. 获取文件内容 =====
    let filesToAnalyze: Array<{ path: string; content: string }>;

    if (hasDirectory) {
      // 方式1：从目录读取文件
      console.log(`[analyze_codebase] 正在读取目录: ${params.directory}`);

      try {
        const fileContents = await readDirectory(params.directory!, {
          include: params.include,
          exclude: params.exclude
        });

        if (fileContents.length === 0) {
          throw new Error(
            `目录 "${params.directory}" 中没有找到匹配的文件。` +
            (params.include ? ` 包含模式: ${params.include.join(', ')}` : '') +
            (params.exclude ? ` 排除模式: ${params.exclude.join(', ')}` : '')
          );
        }

        filesToAnalyze = convertFileContents(fileContents);
        console.log(`[analyze_codebase] 成功读取 ${filesToAnalyze.length} 个文件`);

      } catch (error) {
        // 处理安全错误
        if (error instanceof SecurityError) {
          throw new Error(`安全验证失败: ${error.message}`);
        }
        throw error;
      }

    } else if (hasFilePaths) {
      // 方式2：从文件路径列表读取
      console.log(`[analyze_codebase] 正在读取 ${params.filePaths!.length} 个文件`);

      try {
        const fileContents = await readFiles(params.filePaths!);

        if (fileContents.length === 0) {
          throw new Error('所有指定的文件都无法读取，请检查文件路径是否正确。');
        }

        filesToAnalyze = convertFileContents(fileContents);
        console.log(`[analyze_codebase] 成功读取 ${filesToAnalyze.length} 个文件`);

      } catch (error) {
        if (error instanceof SecurityError) {
          throw new Error(`安全验证失败: ${error.message}`);
        }
        throw error;
      }

    } else {
      // 方式3：直接使用 files 参数（向后兼容）
      validateRequired(params.files, 'files');
      validateArray(params.files!, 'files', 1);

      // 验证每个文件都有 path 和 content
      for (let i = 0; i < params.files!.length; i++) {
        const file = params.files![i];
        if (!file.path || typeof file.path !== 'string') {
          throw new Error(`File at index ${i} is missing required 'path' property`);
        }
        if (!file.content || typeof file.content !== 'string') {
          throw new Error(`File at index ${i} is missing required 'content' property`);
        }
      }

      filesToAnalyze = params.files!;
    }

    // ===== 3. 设置默认值并计算指标 =====
    const outputFormat = params.outputFormat || 'markdown';
    const deepThink = params.deepThink || false;

    // 计算代码库指标
    const languages = new Set<string>();
    let totalLines = 0;

    for (const file of filesToAnalyze) {
      languages.add(detectLanguage(file.path));
      totalLines += file.content.split('\n').length;
    }

    const metrics = {
      totalFiles: filesToAnalyze.length,
      totalLines,
      languages: Array.from(languages).filter(l => l !== 'Unknown')
    };

    // ===== 4. 构建提示词并调用 API =====
    // 创建临时参数对象用于构建提示词
    const promptParams: AnalyzeCodebaseParams = {
      ...params,
      files: filesToAnalyze
    };

    const prompt = buildCodebasePrompt(promptParams, metrics, outputFormat);

    // 调用 Gemini API（使用默认模型 gemini-3-pro-preview）
    // Deep Think 模式使用更高的温度以获得更深入的分析
    const response = await client.generate(prompt, {
      systemInstruction: CODEBASE_ANALYSIS_SYSTEM_PROMPT,
      temperature: deepThink ? 0.7 : 0.5,
      maxTokens: 16384  // 更大的输出 token 限制
    });

    // ===== 5. 构建返回结果 =====
    const result: AnalyzeCodebaseResult = {
      summary: '',
      findings: [],
      metrics,
      analysisDepth: deepThink ? 'deep' : 'standard'
    };

    // 解析响应
    if (outputFormat === 'json') {
      try {
        // 提取 JSON 内容
        let jsonContent = response;
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1].trim();
        }

        const parsed = JSON.parse(jsonContent);
        result.summary = parsed.summary || response;
        result.findings = parsed.findings || [];
        if (parsed.visualization) {
          result.visualization = parsed.visualization;
        }
      } catch {
        // JSON 解析失败，使用原始响应
        result.summary = response;
      }
    } else {
      result.summary = response;

      // 尝试提取 Mermaid 图
      const mermaidMatch = response.match(/```mermaid\s*([\s\S]*?)```/);
      if (mermaidMatch) {
        result.visualization = mermaidMatch[1].trim();
      }
    }

    return result;

  } catch (error: any) {
    logError('analyzeCodebase', error);
    throw handleAPIError(error);
  }
}
