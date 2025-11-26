/**
 * Tool 3: gemini_fix_ui_from_screenshot
 * Identify and fix UI issues from screenshots
 * Priority: P0 - Core functionality
 */

import { GeminiClient } from '../utils/gemini-client.js';
import {
  validateRequired,
  validateString
} from '../utils/validators.js';
import { handleAPIError, logError } from '../utils/error-handler.js';
import { readFile, readFiles, FileContent } from '../utils/file-reader.js';

// System prompt for UI debugging
const UI_FIX_SYSTEM_PROMPT = `You are a UI debugging expert specializing in visual problem diagnosis.

Your expertise:
- Identifying layout issues (alignment, spacing, overflow)
- Detecting styling problems (colors, fonts, borders)
- Spotting responsive design failures
- Finding accessibility issues
- Recognizing browser compatibility problems

Analysis process:
1. Examine the screenshot carefully
2. Identify all visual problems
3. Determine root causes (CSS, HTML structure, JavaScript)
4. Provide targeted fixes

Output requirements:
1. Diagnosis:
   - List all identified issues
   - Explain why each issue occurs
   - Prioritize by severity
2. Fixes:
   - Provide complete code fixes
   - Show before/after comparisons
   - Explain what each fix does
3. Prevention:
   - Suggest best practices to avoid similar issues
   - Recommend tools or techniques

Code quality:
- Minimal changes (fix only what's broken)
- Maintain existing code style
- Add comments explaining fixes
- Ensure backward compatibility`;

export interface FixUIParams {
  screenshot: string;

  // 【新增】源代码文件路径
  sourceCodePath?: string;

  // 【新增】相关文件路径列表
  relatedFiles?: string[];

  // 【保留】直接传入代码内容（向后兼容）
  currentCode?: string;

  issueDescription?: string;
  targetState?: string;
}

export interface FixUIResult {
  diagnosis: string;
  fixes: Array<{
    description: string;
    code: string;
    changes: string[];
    /** 修复针对的文件路径（如果适用） */
    filePath?: string;
  }>;
  preventionTips?: string[];
  /** 分析中使用的源代码文件列表 */
  analyzedFiles?: string[];
}

/**
 * Handle gemini_fix_ui_from_screenshot tool call
 */
export async function handleFixUI(
  params: FixUIParams,
  client: GeminiClient
): Promise<FixUIResult> {
  try {
    // 验证必需参数
    // screenshot 可以是文件路径或 Base64，gemini-client.ts 会自动处理转换
    validateRequired(params.screenshot, 'screenshot');
    validateString(params.screenshot, 'screenshot', 5);

    // 【新增】读取源代码文件
    let codeContext = '';
    const analyzedFiles: string[] = [];

    // 读取主要源代码文件
    if (params.sourceCodePath) {
      try {
        const fileContent = await readFile(params.sourceCodePath);
        analyzedFiles.push(fileContent.path);
        codeContext += `## 主要源代码文件: ${fileContent.path}\n`;
        codeContext += `\`\`\`${fileContent.language?.toLowerCase() || ''}\n`;
        codeContext += fileContent.content;
        codeContext += '\n```\n\n';
      } catch (error) {
        logError('fixUI:readSourceCodePath', error);
        // 继续执行，不中断
      }
    }

    // 读取相关文件
    if (params.relatedFiles && params.relatedFiles.length > 0) {
      try {
        const relatedContents = await readFiles(params.relatedFiles);
        for (const file of relatedContents) {
          analyzedFiles.push(file.path);
          codeContext += `## 相关文件: ${file.path}\n`;
          codeContext += `\`\`\`${file.language?.toLowerCase() || ''}\n`;
          codeContext += file.content;
          codeContext += '\n```\n\n';
        }
      } catch (error) {
        logError('fixUI:readRelatedFiles', error);
        // 继续执行，不中断
      }
    }

    // 向后兼容：如果提供了 currentCode 且没有读取到源文件
    if (params.currentCode && !params.sourceCodePath) {
      codeContext += `## 当前代码\n\`\`\`\n${params.currentCode}\n\`\`\`\n\n`;
    }

    // 构建提示词
    let prompt = `Analyze this screenshot and identify all UI problems.\n\n`;

    if (params.issueDescription) {
      prompt += `Known Issue: ${params.issueDescription}\n\n`;
    }

    // 添加代码上下文
    if (codeContext) {
      prompt += `# Source Code Context\n${codeContext}\n`;
    }

    if (params.targetState) {
      // 检查 targetState 是否是图片
      const isBase64Image = params.targetState.startsWith('data:image');
      const isFilePath = /\.(png|jpg|jpeg|gif|webp|bmp|svg|ico)$/i.test(params.targetState);
      if (!isBase64Image && !isFilePath) {
        prompt += `Expected State: ${params.targetState}\n\n`;
      }
    }

    // 【更新】如果有源代码文件，要求在修复中标明文件路径
    const hasSourceFiles = analyzedFiles.length > 0;
    prompt += `Please provide:
1. Diagnosis: What's wrong and why (analyze both the screenshot and source code)
2. Fixes: Complete code fixes for each issue${hasSourceFiles ? ' (include file path for each fix)' : ''}
3. Prevention: How to avoid similar issues

Format your response as JSON with this structure:
{
  "diagnosis": "detailed analysis",
  "fixes": [
    {
      "description": "what this fix does",
      "code": "complete fixed code",
      "changes": ["list of changes made"]${hasSourceFiles ? ',\n      "filePath": "path/to/file.tsx"' : ''}
    }
  ],
  "preventionTips": ["tip 1", "tip 2"]
}`;

    // 调用 Gemini API
    const images = [params.screenshot];
    // targetState 可以是图片（文件路径或 Base64）或文本描述
    // 如果看起来像图片，则添加到图片列表
    if (params.targetState) {
      const isBase64Image = params.targetState.startsWith('data:image');
      const isFilePath = /\.(png|jpg|jpeg|gif|webp|bmp|svg|ico)$/i.test(params.targetState);
      if (isBase64Image || isFilePath) {
        images.push(params.targetState);
      }
    }

    const response = await client.generateMultimodal(
      prompt,
      images,
      {
        systemInstruction: UI_FIX_SYSTEM_PROMPT,
        temperature: 0.5,
        maxTokens: 6144
      }
    );

    // 尝试解析为 JSON
    try {
      const result = JSON.parse(response);
      // 添加已分析的文件列表
      if (analyzedFiles.length > 0) {
        result.analyzedFiles = analyzedFiles;
      }
      return result;
    } catch {
      // 如果不是 JSON，返回结构化响应
      return {
        diagnosis: response,
        fixes: [{
          description: 'General fix',
          code: extractCodeFromResponse(response),
          changes: ['See diagnosis for details']
        }],
        analyzedFiles: analyzedFiles.length > 0 ? analyzedFiles : undefined
      };
    }

  } catch (error: any) {
    logError('fixUI', error);
    throw handleAPIError(error);
  }
}

/**
 * Extract code from response (if JSON parsing fails)
 */
function extractCodeFromResponse(response: string): string {
  // Try to extract code blocks
  const codeBlocks = response.match(/```[\s\S]*?```/g);
  if (codeBlocks && codeBlocks.length > 0) {
    return codeBlocks.map(block =>
      block.replace(/```[a-z]*\n/g, '').replace(/```/g, '').trim()
    ).join('\n\n');
  }
  return response;
}
