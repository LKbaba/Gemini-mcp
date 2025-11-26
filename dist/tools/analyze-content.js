/**
 * Tool 5: gemini_analyze_content
 * 通用内容分析工具 - 分析代码片段、文档、数据
 * Priority: P1 - Phase 3
 *
 * 升级说明（v1.1）:
 * - 新增 filePath 参数：支持直接传入文件路径，工具自动读取内容
 * - 保留 content 参数：向后兼容原有调用方式
 */
import { validateRequired, validateString, validateArray } from '../utils/validators.js';
import { handleAPIError, logError } from '../utils/error-handler.js';
import { readFile } from '../utils/file-reader.js';
import { SecurityError } from '../utils/security.js';
// 内容分析系统提示词
const ANALYZE_CONTENT_SYSTEM_PROMPT = `You are a versatile code and document analyst with expertise in:
- Code quality analysis (any programming language)
- Document summarization and understanding
- Data structure analysis and optimization
- Technical writing review

Analysis approach:
1. Auto-detect content type (code, document, data)
2. Understand the context and purpose
3. Perform requested task:
   - Summarize: Create concise summary with key points
   - Review: Analyze quality, find issues, suggest improvements
   - Explain: Break down complex content into understandable parts
   - Optimize: Suggest performance and efficiency improvements
   - Debug: Identify potential bugs and logic errors

Output requirements:
- Be clear and actionable
- Prioritize findings by importance
- Provide specific examples
- Use appropriate technical terminology
- Format output for readability

When analyzing code:
- Identify the language automatically
- Check for common patterns and anti-patterns
- Suggest best practices
- Highlight security concerns

When analyzing documents:
- Extract main themes and ideas
- Identify structure and organization
- Suggest improvements for clarity
- Highlight important points

When analyzing data:
- Understand the structure
- Identify patterns and anomalies
- Suggest optimizations
- Explain relationships`;
/**
 * 自动检测内容类型
 */
function detectContentType(content, language) {
    // 如果指定了编程语言，认为是代码
    if (language) {
        return 'code';
    }
    const trimmedContent = content.trim();
    // 检查是否是 JSON/数据
    if (trimmedContent.startsWith('{') || trimmedContent.startsWith('[')) {
        try {
            JSON.parse(trimmedContent);
            return 'data';
        }
        catch {
            // 不是有效 JSON，继续检查
        }
    }
    // 检查 XML/HTML 数据
    if (trimmedContent.startsWith('<?xml') || trimmedContent.match(/^<\w+[^>]*>/)) {
        // 如果看起来像完整的 HTML 页面，可能是代码
        if (trimmedContent.includes('<!DOCTYPE html>') || trimmedContent.includes('<script')) {
            return 'code';
        }
        return 'data';
    }
    // 检查代码特征
    const codePatterns = [
        /function\s+\w+\s*\(/, // JavaScript/TypeScript function
        /const\s+\w+\s*=/, // const declaration
        /let\s+\w+\s*=/, // let declaration
        /var\s+\w+\s*=/, // var declaration
        /class\s+\w+/, // class declaration
        /import\s+.*from\s+['"`]/, // ES6 import
        /export\s+(default\s+)?/, // ES6 export
        /def\s+\w+\s*\(/, // Python function
        /class\s+\w+\s*:/, // Python class
        /public\s+(static\s+)?class/, // Java/C# class
        /private\s+\w+/, // Java/C# private
        /<\?php/, // PHP
        /package\s+\w+/, // Go/Java package
        /func\s+\w+\s*\(/, // Go function
        /fn\s+\w+\s*\(/, // Rust function
        /#include\s*<\w+>/, // C/C++ include
        /using\s+namespace/, // C++ using
        /impl\s+\w+/, // Rust impl
        /struct\s+\w+\s*\{/, // Rust/Go/C struct
        /interface\s+\w+\s*\{/, // TypeScript/Go interface
        /=>\s*\{/, // Arrow function
        /async\s+function/, // Async function
        /await\s+\w+/, // Await expression
    ];
    if (codePatterns.some(pattern => pattern.test(content))) {
        return 'code';
    }
    // 检查是否包含大量代码相关符号
    const codeSymbols = (content.match(/[{}\[\]();=><]/g) || []).length;
    const totalChars = content.length;
    if (codeSymbols / totalChars > 0.05) {
        return 'code';
    }
    // 默认为文档
    return 'document';
}
/**
 * 构建分析提示词
 * @param params 参数对象
 * @param detectedType 检测到的内容类型
 * @param task 分析任务
 * @param outputFormat 输出格式
 * @param contentToAnalyze 要分析的内容（由调用方提供，已从文件读取或直接传入）
 */
function buildAnalysisPrompt(params, detectedType, task, outputFormat, contentToAnalyze) {
    let prompt = `# Content Analysis Task\n\n`;
    prompt += `## Content Type\n${detectedType}\n\n`;
    if (params.language) {
        prompt += `## Programming Language\n${params.language}\n\n`;
    }
    prompt += `## Analysis Task\n`;
    switch (task) {
        case 'summarize':
            prompt += `Create a concise summary of the content, highlighting key points and main ideas.\n\n`;
            break;
        case 'review':
            prompt += `Perform a thorough review. Identify issues, suggest improvements, and evaluate quality.\n\n`;
            break;
        case 'explain':
            prompt += `Explain the content in detail. Break down complex parts into understandable segments.\n\n`;
            break;
        case 'optimize':
            prompt += `Analyze for optimization opportunities. Focus on performance, efficiency, and best practices.\n\n`;
            break;
        case 'debug':
            prompt += `Identify potential bugs, logic errors, and issues. Suggest fixes for each problem found.\n\n`;
            break;
    }
    if (params.focus && params.focus.length > 0) {
        prompt += `## Focus Areas\n`;
        params.focus.forEach(area => {
            prompt += `- ${area}\n`;
        });
        prompt += '\n';
    }
    prompt += `## Output Format\n`;
    if (outputFormat === 'json') {
        prompt += `Provide your response as valid JSON with the following structure:
{
  "summary": "Brief summary",
  "analysis": "Detailed analysis",
  "issues": [{"severity": "high|medium|low", "description": "...", "location": "..."}],
  "suggestions": ["suggestion1", "suggestion2"]
}\n\n`;
    }
    else if (outputFormat === 'markdown') {
        prompt += `Use Markdown formatting for better readability. Include headers, lists, and code blocks where appropriate.\n\n`;
    }
    else {
        prompt += `Provide plain text output.\n\n`;
    }
    prompt += `## Content to Analyze\n\`\`\`\n${contentToAnalyze}\n\`\`\``;
    return prompt;
}
/**
 * 处理 gemini_analyze_content 工具调用
 *
 * 支持两种输入方式（优先级：filePath > content）：
 * 1. filePath: 传入文件路径，自动读取文件内容
 * 2. content: 直接传入内容（向后兼容）
 */
export async function handleAnalyzeContent(params, client) {
    try {
        // ===== 1. 参数验证 =====
        const hasFilePath = !!params.filePath;
        const hasContent = !!params.content;
        // 验证至少提供一种输入方式
        if (!hasFilePath && !hasContent) {
            throw new Error('必须提供 filePath 或 content 参数之一。' +
                '请使用 filePath 传入文件路径，或使用 content 直接传入内容。');
        }
        // 验证可选枚举参数
        const validTypes = ['code', 'document', 'data', 'auto'];
        const validTasks = ['summarize', 'review', 'explain', 'optimize', 'debug'];
        const validFormats = ['text', 'json', 'markdown'];
        if (params.type && !validTypes.includes(params.type)) {
            throw new Error(`Invalid type: ${params.type}. Must be one of: ${validTypes.join(', ')}`);
        }
        if (params.task && !validTasks.includes(params.task)) {
            throw new Error(`Invalid task: ${params.task}. Must be one of: ${validTasks.join(', ')}`);
        }
        if (params.outputFormat && !validFormats.includes(params.outputFormat)) {
            throw new Error(`Invalid outputFormat: ${params.outputFormat}. Must be one of: ${validFormats.join(', ')}`);
        }
        if (params.focus) {
            validateArray(params.focus, 'focus', 1);
        }
        // ===== 2. 获取内容 =====
        let contentToAnalyze;
        let detectedLanguage = params.language;
        if (hasFilePath) {
            // 方式1：从文件读取内容
            console.log(`[analyze_content] 正在读取文件: ${params.filePath}`);
            try {
                const fileContent = await readFile(params.filePath);
                contentToAnalyze = fileContent.content;
                // 如果没有指定语言，使用检测到的语言
                if (!detectedLanguage && fileContent.language) {
                    detectedLanguage = fileContent.language;
                }
                console.log(`[analyze_content] 成功读取文件，大小: ${fileContent.size} 字节`);
            }
            catch (error) {
                if (error instanceof SecurityError) {
                    throw new Error(`安全验证失败: ${error.message}`);
                }
                throw error;
            }
        }
        else {
            // 方式2：直接使用 content 参数（向后兼容）
            validateRequired(params.content, 'content');
            validateString(params.content, 'content', 10);
            contentToAnalyze = params.content;
        }
        // ===== 3. 设置默认值并检测类型 =====
        const type = params.type || 'auto';
        const task = params.task || 'summarize';
        const outputFormat = params.outputFormat || 'markdown';
        // 自动检测内容类型
        const detectedType = type === 'auto'
            ? detectContentType(contentToAnalyze, detectedLanguage)
            : type;
        // ===== 4. 构建提示词 =====
        // 创建临时参数对象用于构建提示词
        const promptParams = {
            ...params,
            content: contentToAnalyze,
            language: detectedLanguage
        };
        const prompt = buildAnalysisPrompt(promptParams, detectedType, task, outputFormat, contentToAnalyze);
        // 调用 Gemini API（使用默认模型 gemini-3-pro-preview）
        const response = await client.generate(prompt, {
            systemInstruction: ANALYZE_CONTENT_SYSTEM_PROMPT,
            temperature: 0.5,
            maxTokens: 8192
        });
        // 构建返回结果
        const result = {
            analysis: response,
            contentType: detectedType,
            task: task
        };
        // 如果是 JSON 格式，尝试解析并提取结构化数据
        if (outputFormat === 'json') {
            try {
                // 提取 JSON 内容（可能被包裹在 markdown 代码块中）
                let jsonContent = response;
                const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
                if (jsonMatch) {
                    jsonContent = jsonMatch[1].trim();
                }
                const parsed = JSON.parse(jsonContent);
                if (parsed.summary)
                    result.summary = parsed.summary;
                if (parsed.suggestions)
                    result.suggestions = parsed.suggestions;
                if (parsed.issues)
                    result.issues = parsed.issues;
            }
            catch {
                // JSON 解析失败，保持原始响应
            }
        }
        return result;
    }
    catch (error) {
        logError('analyzeContent', error);
        throw handleAPIError(error);
    }
}
//# sourceMappingURL=analyze-content.js.map