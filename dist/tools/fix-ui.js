/**
 * Tool 3: gemini_fix_ui_from_screenshot
 * Identify and fix UI issues from screenshots
 * Priority: P0 - Core functionality
 */
import { GoogleGenAI } from '@google/genai';
import { validateRequired, validateString } from '../utils/validators.js';
import { handleAPIError, logError } from '../utils/error-handler.js';
import { readFile, readFiles } from '../utils/file-reader.js';
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
/**
 * Handle gemini_fix_ui_from_screenshot tool call
 */
export async function handleFixUI(params, client) {
    try {
        // Validate required parameters
        // screenshot can be file path or Base64, gemini-client.ts will handle conversion automatically
        validateRequired(params.screenshot, 'screenshot');
        validateString(params.screenshot, 'screenshot', 5);
        // [NEW] Read source code files
        let codeContext = '';
        const analyzedFiles = [];
        // Read main source code file
        if (params.sourceCodePath) {
            try {
                const fileContent = await readFile(params.sourceCodePath);
                analyzedFiles.push(fileContent.path);
                codeContext += `## Main source code file: ${fileContent.path}\n`;
                codeContext += `\`\`\`${fileContent.language?.toLowerCase() || ''}\n`;
                codeContext += fileContent.content;
                codeContext += '\n```\n\n';
            }
            catch (error) {
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
            }
            catch (error) {
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
        // [UPDATE] If there are source code files, require file path in fixes
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
        let response;
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
        const config = {
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
        // Try to parse as JSON
        try {
            const parsedResult = JSON.parse(response);
            // Add analyzed files list
            if (analyzedFiles.length > 0) {
                parsedResult.analyzedFiles = analyzedFiles;
            }
            return parsedResult;
        }
        catch {
            // If not JSON, return structured response
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
    }
    catch (error) {
        logError('fixUI', error);
        throw handleAPIError(error);
    }
}
/**
 * Extract code from response (if JSON parsing fails)
 */
function extractCodeFromResponse(response) {
    // Try to extract code blocks
    const codeBlocks = response.match(/```[\s\S]*?```/g);
    if (codeBlocks && codeBlocks.length > 0) {
        return codeBlocks.map(block => block.replace(/```[a-z]*\n/g, '').replace(/```/g, '').trim()).join('\n\n');
    }
    return response;
}
//# sourceMappingURL=fix-ui.js.map