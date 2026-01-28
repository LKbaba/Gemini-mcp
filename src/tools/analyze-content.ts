/**
 * Tool 5: gemini_analyze_content
 * General content analysis tool - Analyze code snippets, documents, data
 * Priority: P1 - Phase 3
 *
 * Upgrade notes (v1.1):
 * - Added filePath parameter: Support direct file path input, tool automatically reads content
 * - Retained content parameter: Backward compatible with original calling method
 */

import { GeminiClient } from '../utils/gemini-client.js';
import {
  validateRequired,
  validateString,
  validateArray
} from '../utils/validators.js';
import { handleAPIError, logError } from '../utils/error-handler.js';
import { readFile, FileContent } from '../utils/file-reader.js';
import { SecurityError } from '../utils/security.js';

// Content analysis system prompt
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

// Supported model types
type SupportedModel = 'gemini-3-pro-preview' | 'gemini-3-flash-preview';

// Parameter interface
export interface AnalyzeContentParams {
  // ===== Input method (choose one) =====

  /**
   * Method 1: Direct content input [Retained, backward compatible]
   */
  content?: string;

  /**
   * Method 2: File path input [New]
   * Tool will automatically read file content and detect language
   */
  filePath?: string;

  // ===== Other parameters (unchanged) =====
  type?: 'code' | 'document' | 'data' | 'auto';
  task?: 'summarize' | 'review' | 'explain' | 'optimize' | 'debug';
  language?: string;
  focus?: string[];
  outputFormat?: 'text' | 'json' | 'markdown';
  model?: SupportedModel;  // v1.2.0: Model selection parameter
}

// Return interface
export interface AnalyzeContentResult {
  analysis: string;
  contentType: string;
  task: string;
  suggestions?: string[];
  issues?: Array<{
    severity: 'high' | 'medium' | 'low';
    description: string;
    location?: string;
  }>;
  summary?: string;
}

/**
 * Auto-detect content type
 */
function detectContentType(content: string, language?: string): 'code' | 'document' | 'data' {
  // If programming language is specified, consider it as code
  if (language) {
    return 'code';
  }

  const trimmedContent = content.trim();

  // Check if it's JSON/data
  if (trimmedContent.startsWith('{') || trimmedContent.startsWith('[')) {
    try {
      JSON.parse(trimmedContent);
      return 'data';
    } catch {
      // Not valid JSON, continue checking
    }
  }

  // Check XML/HTML data
  if (trimmedContent.startsWith('<?xml') || trimmedContent.match(/^<\w+[^>]*>/)) {
    // If it looks like a complete HTML page, it might be code
    if (trimmedContent.includes('<!DOCTYPE html>') || trimmedContent.includes('<script')) {
      return 'code';
    }
    return 'data';
  }

  // Check code characteristics
  const codePatterns = [
    /function\s+\w+\s*\(/,           // JavaScript/TypeScript function
    /const\s+\w+\s*=/,               // const declaration
    /let\s+\w+\s*=/,                 // let declaration
    /var\s+\w+\s*=/,                 // var declaration
    /class\s+\w+/,                   // class declaration
    /import\s+.*from\s+['"`]/,       // ES6 import
    /export\s+(default\s+)?/,        // ES6 export
    /def\s+\w+\s*\(/,                // Python function
    /class\s+\w+\s*:/,               // Python class
    /public\s+(static\s+)?class/,    // Java/C# class
    /private\s+\w+/,                 // Java/C# private
    /<\?php/,                        // PHP
    /package\s+\w+/,                 // Go/Java package
    /func\s+\w+\s*\(/,               // Go function
    /fn\s+\w+\s*\(/,                 // Rust function
    /#include\s*<\w+>/,              // C/C++ include
    /using\s+namespace/,             // C++ using
    /impl\s+\w+/,                    // Rust impl
    /struct\s+\w+\s*\{/,             // Rust/Go/C struct
    /interface\s+\w+\s*\{/,          // TypeScript/Go interface
    /=>\s*\{/,                       // Arrow function
    /async\s+function/,              // Async function
    /await\s+\w+/,                   // Await expression
  ];

  if (codePatterns.some(pattern => pattern.test(content))) {
    return 'code';
  }

  // Check if it contains a lot of code-related symbols
  const codeSymbols = (content.match(/[{}\[\]();=><]/g) || []).length;
  const totalChars = content.length;
  if (codeSymbols / totalChars > 0.05) {
    return 'code';
  }

  // Default to document
  return 'document';
}

/**
 * Build analysis prompt
 * @param params Parameter object
 * @param detectedType Detected content type
 * @param task Analysis task
 * @param outputFormat Output format
 * @param contentToAnalyze Content to analyze (provided by caller, read from file or directly passed in)
 */
function buildAnalysisPrompt(
  params: AnalyzeContentParams,
  detectedType: string,
  task: string,
  outputFormat: string,
  contentToAnalyze: string
): string {
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
  } else if (outputFormat === 'markdown') {
    prompt += `Use Markdown formatting for better readability. Include headers, lists, and code blocks where appropriate.\n\n`;
  } else {
    prompt += `Provide plain text output.\n\n`;
  }

  prompt += `## Content to Analyze\n\`\`\`\n${contentToAnalyze}\n\`\`\``;

  return prompt;
}

/**
 * Handle gemini_analyze_content tool call
 *
 * Supports two input methods (priority: filePath > content):
 * 1. filePath: Pass file path, automatically read file content
 * 2. content: Direct content input (backward compatible)
 */
export async function handleAnalyzeContent(
  params: AnalyzeContentParams,
  client: GeminiClient
): Promise<AnalyzeContentResult> {
  try {
    // ===== 1. Parameter validation =====
    const hasFilePath = !!params.filePath;
    const hasContent = !!params.content;

    // Validate that at least one input method is provided
    if (!hasFilePath && !hasContent) {
      throw new Error(
        'One of filePath or content parameter is required. ' +
        'Please use filePath to pass a file path, or use content to pass content directly.'
      );
    }

    // Validate optional enum parameters
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

    // ===== 2. Get content =====
    let contentToAnalyze: string;
    let detectedLanguage: string | undefined = params.language;

    if (hasFilePath) {
      // Method 1: Read content from file
      console.log(`[analyze_content] Reading file: ${params.filePath}`);

      try {
        const fileContent = await readFile(params.filePath!);
        contentToAnalyze = fileContent.content;

        // If no language specified, use detected language
        if (!detectedLanguage && fileContent.language) {
          detectedLanguage = fileContent.language;
        }

        console.log(`[analyze_content] Successfully read file, size: ${fileContent.size} bytes`);

      } catch (error) {
        if (error instanceof SecurityError) {
          throw new Error(`Security validation failed: ${error.message}`);
        }
        throw error;
      }

    } else {
      // Method 2: Direct use of content parameter (backward compatible)
      validateRequired(params.content, 'content');
      validateString(params.content!, 'content', 10);
      contentToAnalyze = params.content!;
    }

    // ===== 3. Set defaults and detect type =====
    const type = params.type || 'auto';
    const task = params.task || 'summarize';
    const outputFormat = params.outputFormat || 'markdown';

    // Auto-detect content type
    const detectedType = type === 'auto'
      ? detectContentType(contentToAnalyze, detectedLanguage)
      : type;

    // ===== 4. Build prompt =====
    // Create temporary parameter object for building prompt
    const promptParams: AnalyzeContentParams = {
      ...params,
      content: contentToAnalyze,
      language: detectedLanguage
    };

    const prompt = buildAnalysisPrompt(promptParams, detectedType, task, outputFormat, contentToAnalyze);

    // v1.2.0: Use user-selected model (default: gemini-3-pro-preview)
    const modelToUse = params.model || 'gemini-3-pro-preview';
    client.setModel(modelToUse);

    // Call Gemini API
    const response = await client.generate(prompt, {
      systemInstruction: ANALYZE_CONTENT_SYSTEM_PROMPT,
      temperature: 0.5,
      maxTokens: 8192
    });

    // Build return result
    const result: AnalyzeContentResult = {
      analysis: response,
      contentType: detectedType,
      task: task
    };

    // If JSON format, try to parse and extract structured data
    if (outputFormat === 'json') {
      try {
        // Extract JSON content (may be wrapped in markdown code block)
        let jsonContent = response;
        const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonContent = jsonMatch[1].trim();
        }

        const parsed = JSON.parse(jsonContent);
        if (parsed.summary) result.summary = parsed.summary;
        if (parsed.suggestions) result.suggestions = parsed.suggestions;
        if (parsed.issues) result.issues = parsed.issues;
      } catch {
        // JSON parsing failed, keep original response
      }
    }

    return result;

  } catch (error: any) {
    logError('analyzeContent', error);
    throw handleAPIError(error);
  }
}
