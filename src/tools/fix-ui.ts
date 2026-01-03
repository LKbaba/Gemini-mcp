/**
 * Tool 3: gemini_fix_ui_from_screenshot
 * Visual Debug Loop - Identify and fix UI issues from screenshots
 *
 * Core features:
 * - Requires three inputs: screenshot + source code + issue description
 * - Outputs git diff format patches for direct application
 *
 * Priority: P0 - Core functionality
 */

import { GoogleGenAI } from '@google/genai';
import { GeminiClient } from '../utils/gemini-client.js';
import {
  validateRequired,
  validateString
} from '../utils/validators.js';
import { handleAPIError, logError } from '../utils/error-handler.js';
import { readFile, readFiles, FileContent } from '../utils/file-reader.js';

// System prompt for Visual Debug Loop
const UI_FIX_SYSTEM_PROMPT = `You are a professional UI visual debugging expert, specializing in diagnosing and fixing frontend issues from screenshots.

## Your expertise:
- Identifying layout issues (alignment, spacing, overflow)
- Detecting styling problems (colors, fonts, borders)
- Spotting responsive design failures
- Finding accessibility issues
- Recognizing browser compatibility problems

## Workflow (Visual Debug Loop):
1. Carefully analyze visual problems in the screenshot
2. Cross-reference with source code to locate root cause
3. Understand the user's expected behavior
4. Generate precise code fixes (git diff format)

## Output requirements:

### 1. Diagnosis
- List all identified issues
- Explain the root cause of each issue
- Prioritize by severity

### 2. Patches
**Must use unified diff format**, example:
\`\`\`diff
--- a/src/components/Button.tsx
+++ b/src/components/Button.tsx
@@ -15,7 +15,7 @@ export const Button = ({ children }) => {
   return (
     <button
-      className="px-4 py-2 bg-blue-500"
+      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 transition-colors"
       onClick={handleClick}
     >
\`\`\`

### 3. Changes
- Explain the purpose of each modification
- Describe why the fix is effective

### 4. Prevention Tips
- How to avoid similar issues
- Recommended tools or best practices

## Code quality principles:
- Minimal changes (fix only what's broken)
- Maintain existing code style
- Ensure backward compatibility`;

export interface FixUIParams {
  screenshot: string;

  // [NEW] Source code file path
  sourceCodePath?: string;

  // [NEW] Related files path list
  relatedFiles?: string[];

  // [KEEP] Direct code input (backward compatible)
  currentCode?: string;

  issueDescription?: string;
  targetState?: string;
  
  /**
   * Thinking level for complex debugging (default: high)
   * high is recommended for complex UI issues
   */
  thinkingLevel?: 'low' | 'high';
}

/**
 * Single file patch
 */
export interface FilePatch {
  /** Target file path */
  filePath: string;
  /** Unified diff format patch content */
  diff: string;
  /** Change descriptions */
  changes: string[];
}

/**
 * Visual Debug Loop result
 */
export interface FixUIResult {
  /** Problem diagnosis report */
  diagnosis: string;
  /** Git diff format patch list */
  patches: FilePatch[];
  /** Prevention tips */
  preventionTips?: string[];
  /** List of source code files used in analysis */
  analyzedFiles?: string[];

  // Legacy fixes field (deprecated, use patches instead)
  fixes?: Array<{
    description: string;
    code: string;
    changes: string[];
    filePath?: string;
  }>;
}

/**
 * Handle gemini_fix_ui_from_screenshot tool call
 */
export async function handleFixUI(
  params: FixUIParams,
  client: GeminiClient
): Promise<FixUIResult> {
  try {
    // Validate required parameters
    // screenshot can be file path or Base64, gemini-client.ts will handle conversion automatically
    validateRequired(params.screenshot, 'screenshot');
    validateString(params.screenshot, 'screenshot', 5);

    // [NEW] Read source code files
    let codeContext = '';
    const analyzedFiles: string[] = [];

    // Read main source code file
    if (params.sourceCodePath) {
      try {
        const fileContent = await readFile(params.sourceCodePath);
        analyzedFiles.push(fileContent.path);
        codeContext += `## Main source code file: ${fileContent.path}\n`;
        codeContext += `\`\`\`${fileContent.language?.toLowerCase() || ''}\n`;
        codeContext += fileContent.content;
        codeContext += '\n```\n\n';
      } catch (error) {
        logError('fixUI:readSourceCodePath', error);
        // Continue execution, do not interrupt
      }
    }

    // Read related files
    if (params.relatedFiles && params.relatedFiles.length > 0) {
      try {
        const relatedContents = await readFiles(params.relatedFiles);
        for (const file of relatedContents) {
          analyzedFiles.push(file.path);
          codeContext += `## Related file: ${file.path}\n`;
          codeContext += `\`\`\`${file.language?.toLowerCase() || ''}\n`;
          codeContext += file.content;
          codeContext += '\n```\n\n';
        }
      } catch (error) {
        logError('fixUI:readRelatedFiles', error);
        // Continue execution, do not interrupt
      }
    }

    // Backward compatibility: if currentCode provided and no source file read
    if (params.currentCode && !params.sourceCodePath) {
      codeContext += `## Current code\n\`\`\`\n${params.currentCode}\n\`\`\`\n\n`;
    }

    // Build prompt
    let prompt = `Analyze this screenshot and identify all UI problems.\n\n`;

    if (params.issueDescription) {
      prompt += `Known Issue: ${params.issueDescription}\n\n`;
    }

    // Add code context
    if (codeContext) {
      prompt += `# Source Code Context\n${codeContext}\n`;
    }

    if (params.targetState) {
      // Check if targetState is an image
      const isBase64Image = params.targetState.startsWith('data:image');
      const isFilePath = /\.(png|jpg|jpeg|gif|webp|bmp|svg|ico)$/i.test(params.targetState);
      if (!isBase64Image && !isFilePath) {
        prompt += `Expected State: ${params.targetState}\n\n`;
      }
    }

    // Build Visual Debug Loop output requirements
    const hasSourceFiles = analyzedFiles.length > 0;

    if (!hasSourceFiles && !params.currentCode) {
      prompt += `\n⚠️ Warning: No source code provided. Please provide sourceCodePath or relatedFiles for more accurate git diff patches.\n\n`;
    }

    prompt += `Please output the fix in the following JSON format:

{
  "diagnosis": "Detailed problem diagnosis report including cause and severity",
  "patches": [
    {
      "filePath": "src/components/Example.tsx",
      "diff": "--- a/src/components/Example.tsx\\n+++ b/src/components/Example.tsx\\n@@ -10,3 +10,3 @@\\n-  old code\\n+  new code",
      "changes": ["Change description 1", "Change description 2"]
    }
  ],
  "preventionTips": ["Prevention tip 1", "Prevention tip 2"]
}

Important requirements:
1. The diff in patches must be valid unified diff format
2. Each patch must include the complete file path
3. The diff content should include sufficient context (at least 3 lines)
4. Ensure the diff can be directly applied with 'git apply'`;

    // Call Gemini API
    const images = [params.screenshot];
    // targetState can be an image (file path or Base64) or text description
    // If it looks like an image, add it to the image list
    if (params.targetState) {
      const isBase64Image = params.targetState.startsWith('data:image');
      const isFilePath = /\.(png|jpg|jpeg|gif|webp|bmp|svg|ico)$/i.test(params.targetState);
      if (isBase64Image || isFilePath) {
        images.push(params.targetState);
      }
    }

    // Determine thinking level (default high for complex debugging)
    const thinkingLevel = params.thinkingLevel || 'high';

    let response: string;

    // Always use thinking mode with direct GoogleGenAI call
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }

    const ai = new GoogleGenAI({ apiKey });

    // Convert images to inline data format
    const imageParts = await Promise.all(images.map(async (img) => {
      const { convertImageToInlineData } = await import('../utils/gemini-client.js');
      const { mimeType, data } = convertImageToInlineData(img);
      return { inlineData: { mimeType, data } };
    }));

    const config: any = {
      thinkingConfig: { thinkingLevel },
      systemInstruction: UI_FIX_SYSTEM_PROMPT,
    };

    const contents = [{
      role: 'user',
      parts: [{ text: prompt }, ...imageParts]
    }];

    const apiResult = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      config,
      contents,
    });

    response = apiResult.text || '';

    // Try to parse JSON response
    try {
      const parsedResult = JSON.parse(response);

      // Add analyzed files list
      if (analyzedFiles.length > 0) {
        parsedResult.analyzedFiles = analyzedFiles;
      }

      // Ensure patches field exists (compatibility handling)
      if (!parsedResult.patches && parsedResult.fixes) {
        // Convert legacy fixes format to new patches format
        parsedResult.patches = parsedResult.fixes.map((fix: any) => ({
          filePath: fix.filePath || 'unknown',
          diff: fix.code || '',
          changes: fix.changes || [fix.description]
        }));
      }

      return parsedResult;
    } catch {
      // If not JSON, try to extract code blocks as diff
      const diffBlocks = extractDiffFromResponse(response);

      return {
        diagnosis: response,
        patches: diffBlocks.length > 0 ? diffBlocks : [{
          filePath: 'unknown',
          diff: extractCodeFromResponse(response),
          changes: ['See diagnosis report for details']
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
 * Extract diff code blocks from response
 */
function extractDiffFromResponse(response: string): FilePatch[] {
  const patches: FilePatch[] = [];

  // Match diff code blocks
  const diffPattern = /```diff\n([\s\S]*?)```/g;
  let match;

  while ((match = diffPattern.exec(response)) !== null) {
    const diffContent = match[1].trim();

    // Try to extract file path from diff header
    const filePathMatch = diffContent.match(/^---\s+a\/(.+)$/m);
    const filePath = filePathMatch ? filePathMatch[1] : 'unknown';

    patches.push({
      filePath,
      diff: diffContent,
      changes: ['Diff patch extracted from response']
    });
  }

  return patches;
}

/**
 * Extract code blocks from response (fallback when JSON parsing fails)
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
