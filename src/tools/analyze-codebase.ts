/**
 * Tool 6: gemini_analyze_codebase
 * Codebase analysis tool - Leveraging 1M token context to analyze entire codebase
 * Priority: P1 - Phase 3
 *
 * Upgrade notes (v1.1):
 * - Added directory parameter: Support direct directory path input
 * - Added filePaths parameter: Support file path list input
 * - Added include/exclude parameters: Support glob pattern filtering
 * - Retained files parameter: Backward compatible with original usage
 */

import { GoogleGenAI } from '@google/genai';
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

// Codebase analysis system prompt
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

// Parameter interface
export interface AnalyzeCodebaseParams {
  // ===== Input methods (choose one) =====

  /**
   * Method 1: Directory path [NEW]
   * Pass directory path directly, tool will automatically read files in the directory
   */
  directory?: string;

  /**
   * Glob include patterns, only used with directory parameter
   * Example: ["**\/*.ts", "**\/*.tsx"]
   */
  include?: string[];

  /**
   * Glob exclude patterns, only used with directory parameter
   * Example: ["node_modules/**", "**\/*.test.ts"]
   */
  exclude?: string[];

  /**
   * Method 2: File path list [NEW]
   * Pass file path list, tool will automatically read these files
   */
  filePaths?: string[];

  /**
   * Method 3: File content array [RETAINED, backward compatible]
   * Pass file content directly, no need for tool to read
   */
  files?: Array<{
    path: string;
    content: string;
  }>;

  // ===== Other parameters (unchanged) =====
  focus?: 'architecture' | 'security' | 'performance' | 'dependencies' | 'patterns';
  deepThink?: boolean;
  outputFormat?: 'markdown' | 'json';
  
  /**
   * Thinking level for complex analysis (default: high)
   * high is recommended for architecture and security analysis
   */
  thinkingLevel?: 'low' | 'high';
}

// Return interface
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
 * Detect programming language of file
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
 * Build codebase analysis prompt
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

  // Add all file contents (params.files is guaranteed to have value before this call)
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
 * Convert FileContent array to internal file format
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
 * Handle gemini_analyze_codebase tool call
 *
 * Supports three input methods (priority: directory > filePaths > files):
 * 1. directory: Pass directory path, automatically read files in directory
 * 2. filePaths: Pass file path list, automatically read these files
 * 3. files: Pass file content array directly (backward compatible)
 */
export async function handleAnalyzeCodebase(
  params: AnalyzeCodebaseParams,
  client: GeminiClient
): Promise<AnalyzeCodebaseResult> {
  try {
    // ===== 1. Parameter validation =====
    const hasDirectory = !!params.directory;
    const hasFilePaths = params.filePaths && params.filePaths.length > 0;
    const hasFiles = params.files && params.files.length > 0;

    // Validate at least one input method is provided
    if (!hasDirectory && !hasFilePaths && !hasFiles) {
      throw new Error(
        'One of directory, filePaths, or files parameter is required. ' +
        'Use directory to pass a directory path, filePaths to pass a file path list, or files to pass a file content array.'
      );
    }

    // Validate optional enum parameters
    const validFocusAreas = ['architecture', 'security', 'performance', 'dependencies', 'patterns'];
    const validFormats = ['markdown', 'json'];

    if (params.focus && !validFocusAreas.includes(params.focus)) {
      throw new Error(`Invalid focus: ${params.focus}. Must be one of: ${validFocusAreas.join(', ')}`);
    }
    if (params.outputFormat && !validFormats.includes(params.outputFormat)) {
      throw new Error(`Invalid outputFormat: ${params.outputFormat}. Must be one of: ${validFormats.join(', ')}`);
    }

    // ===== 2. Get file contents =====
    let filesToAnalyze: Array<{ path: string; content: string }>;

    if (hasDirectory) {
      // Method 1: Read files from directory
      console.log(`[analyze_codebase] Reading directory: ${params.directory}`);

      try {
        const fileContents = await readDirectory(params.directory!, {
          include: params.include,
          exclude: params.exclude
        });

        if (fileContents.length === 0) {
          throw new Error(
            `No matching files found in directory "${params.directory}".` +
            (params.include ? ` Include patterns: ${params.include.join(', ')}` : '') +
            (params.exclude ? ` Exclude patterns: ${params.exclude.join(', ')}` : '')
          );
        }

        filesToAnalyze = convertFileContents(fileContents);
        console.log(`[analyze_codebase] Successfully read ${filesToAnalyze.length} files`);

      } catch (error) {
        // Handle security errors
        if (error instanceof SecurityError) {
          throw new Error(`Security validation failed: ${error.message}`);
        }
        throw error;
      }

    } else if (hasFilePaths) {
      // Method 2: Read from file path list
      console.log(`[analyze_codebase] Reading ${params.filePaths!.length} files`);

      try {
        const fileContents = await readFiles(params.filePaths!);

        if (fileContents.length === 0) {
          throw new Error('All specified files could not be read. Please check if file paths are correct.');
        }

        filesToAnalyze = convertFileContents(fileContents);
        console.log(`[analyze_codebase] Successfully read ${filesToAnalyze.length} files`);

      } catch (error) {
        if (error instanceof SecurityError) {
          throw new Error(`Security validation failed: ${error.message}`);
        }
        throw error;
      }

    } else {
      // Method 3: Use files parameter directly (backward compatible)
      validateRequired(params.files, 'files');
      validateArray(params.files!, 'files', 1);

      // Validate each file has path and content
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

    // ===== 3. Set defaults and calculate metrics =====
    const outputFormat = params.outputFormat || 'markdown';
    const deepThink = params.deepThink || false;

    // Calculate codebase metrics
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

    // ===== 4. Build prompt and call API =====
    // Create temporary params object for building prompt
    const promptParams: AnalyzeCodebaseParams = {
      ...params,
      files: filesToAnalyze
    };

    const prompt = buildCodebasePrompt(promptParams, metrics, outputFormat);

    // Determine thinking level (default high for complex analysis)
    const thinkingLevel = params.thinkingLevel || 'high';

    let response: string;

    // Always use thinking mode with direct GoogleGenAI call
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    const ai = new GoogleGenAI({ apiKey });

    const config: any = {
      thinkingConfig: { thinkingLevel },
      systemInstruction: CODEBASE_ANALYSIS_SYSTEM_PROMPT,
    };

    const contents = [{
      role: 'user',
      parts: [{ text: prompt }]
    }];

    const apiResult = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      config,
      contents,
    });

    response = apiResult.text || '';

    // ===== 5. Build return result =====
    const result: AnalyzeCodebaseResult = {
      summary: '',
      findings: [],
      metrics,
      analysisDepth: deepThink ? 'deep' : 'standard'
    };

    // Parse response
    if (outputFormat === 'json') {
      try {
        // Extract JSON content
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
        // JSON parsing failed, use raw response
        result.summary = response;
      }
    } else {
      result.summary = response;

      // Try to extract Mermaid diagram
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
