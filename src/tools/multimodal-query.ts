/**
 * Tool 2: gemini_multimodal_query
 * Query using images + text for multimodal understanding
 * Priority: P0 - Core functionality
 */

import { GeminiClient } from '../utils/gemini-client.js';
import {
  validateRequired,
  validateString,
  validateArray,
  validateOutputFormat
} from '../utils/validators.js';
import { handleAPIError, logError } from '../utils/error-handler.js';

// System prompt for multimodal query
const MULTIMODAL_QUERY_SYSTEM_PROMPT = `You are a visual understanding expert with deep knowledge of:
- UI/UX design patterns and principles
- Frontend development (HTML/CSS/JavaScript)
- Architecture diagrams and technical documentation
- Design systems and component libraries

When analyzing images:
1. Identify all key elements and their purposes
2. Understand spatial relationships and layouts
3. Recognize design patterns and conventions
4. Detect colors, typography, spacing with precision
5. Infer interactive states (hover, active, disabled)

When asked to convert designs to code:
- Provide complete, production-ready implementation
- Match the design pixel-perfectly
- Include all visible and implied interactions

When asked questions about designs:
- Be specific and detailed
- Reference exact colors (hex codes)
- Mention spacing values when relevant
- Suggest improvements if asked

Output format:
- Adapt to the requested format (text/code/json)
- Be concise but comprehensive
- Use professional terminology`;

// Supported model types
type SupportedModel = 'gemini-3-pro-preview' | 'gemini-3-flash-preview';

export interface MultimodalQueryParams {
  prompt: string;
  images: string[];
  outputFormat?: 'text' | 'code' | 'json';
  context?: string;
  model?: SupportedModel;  // v1.2.0: Model selection parameter
}

export interface MultimodalQueryResult {
  response: string;
  format: string;
  metadata?: {
    imageCount: number;
    modelUsed: string;
  };
}

/**
 * Handle gemini_multimodal_query tool call
 */
export async function handleMultimodalQuery(
  params: MultimodalQueryParams,
  client: GeminiClient
): Promise<MultimodalQueryResult> {
  try {
    // Validate required parameters
    validateRequired(params.prompt, 'prompt');
    validateString(params.prompt, 'prompt', 5);
    validateRequired(params.images, 'images');
    validateArray(params.images, 'images', 1);

    // Validate optional parameters
    const outputFormat = params.outputFormat || 'text';
    if (params.outputFormat) {
      validateOutputFormat(params.outputFormat);
    }

    // Build the prompt
    let fullPrompt = params.prompt;

    if (params.context) {
      fullPrompt = `Context: ${params.context}\n\nQuestion: ${params.prompt}`;
    }

    if (outputFormat === 'json') {
      fullPrompt += `\n\nPlease provide your response in valid JSON format.`;
    } else if (outputFormat === 'code') {
      fullPrompt += `\n\nPlease provide your response as code only, no explanations.`;
    }

    // v1.2.0: Use user-selected model (default: gemini-3-pro-preview)
    const modelToUse = params.model || 'gemini-3-pro-preview';
    client.setModel(modelToUse);

    // Call Gemini API with multimodal input
    const response = await client.generateMultimodal(
      fullPrompt,
      params.images,
      {
        systemInstruction: MULTIMODAL_QUERY_SYSTEM_PROMPT,
        temperature: 0.7,
        maxTokens: 4096
      }
    );

    return {
      response,
      format: outputFormat,
      metadata: {
        imageCount: params.images.length,
        modelUsed: client.getModel()
      }
    };

  } catch (error: any) {
    logError('multimodalQuery', error);
    throw handleAPIError(error);
  }
}
