/**
 * Tool: gemini_search
 * Web search using Gemini's built-in Google Search grounding
 */

import { GoogleGenAI } from '@google/genai';
import {
  validateRequired,
  validateString
} from '../utils/validators.js';
import { handleAPIError, logError } from '../utils/error-handler.js';

// Search system prompt
const SEARCH_SYSTEM_PROMPT = `You are a helpful research assistant with access to Google Search.
When answering questions:
1. Use the search results to provide accurate, up-to-date information
2. Cite sources when possible
3. Be clear about what information comes from search results
4. If search results are insufficient, acknowledge limitations
5. Synthesize information from multiple sources when relevant`;

// Parameter interface
export interface SearchParams {
  query: string;
  context?: string;
  thinkingLevel?: 'low' | 'high';
  outputFormat?: 'text' | 'json';
}

// Return interface
export interface SearchResult {
  query: string;
  response: string;
  groundingMetadata?: {
    searchQueries?: string[];
    webSearchSources?: Array<{
      title?: string;
      uri?: string;
    }>;
  };
  metadata: {
    modelUsed: string;
    thinkingLevel: string;
    outputFormat: string;
  };
}

/**
 * Handle gemini_search tool invocation
 */
export async function handleSearch(
  params: SearchParams,
  apiKey: string
): Promise<SearchResult> {
  try {
    // Parameter validation
    validateRequired(params.query, 'query');
    validateString(params.query, 'query', 2);

    if (params.context) {
      validateString(params.context, 'context', 2);
    }

    const thinkingLevel = params.thinkingLevel || 'high';
    const outputFormat = params.outputFormat || 'text';

    // Create AI client
    const ai = new GoogleGenAI({ apiKey });

    // Configure tools with Google Search
    const tools = [{ googleSearch: {} }];

    const config: any = {
      tools,
      thinkingConfig: { thinkingLevel },
    };

    // Add JSON output configuration if requested
    if (outputFormat === 'json') {
      config.responseMimeType = 'application/json';
    }

    // Build prompt
    let prompt = params.query;
    if (params.context) {
      prompt = `Context: ${params.context}\n\nQuestion: ${params.query}`;
    }

    const model = 'gemini-3-pro-preview';
    const contents = [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];

    // Add system instruction to config
    config.systemInstruction = SEARCH_SYSTEM_PROMPT;

    // Call Gemini API with search grounding
    const response = await ai.models.generateContent({
      model,
      config,
      contents,
    });

    // Extract response text
    const responseText = response.text || '';

    // Extract grounding metadata if available
    let groundingMetadata: SearchResult['groundingMetadata'];
    
    const candidate = response.candidates?.[0];
    if (candidate?.groundingMetadata) {
      const metadata = candidate.groundingMetadata as any;
      groundingMetadata = {
        searchQueries: metadata.webSearchQueries,
        webSearchSources: metadata.groundingSupports?.map((support: any) => ({
          title: support.segment?.text,
          uri: support.groundingChunkIndices?.[0] !== undefined
            ? metadata.groundingChunks?.[support.groundingChunkIndices[0]]?.web?.uri
            : undefined,
        })),
      };
    }

    return {
      query: params.query,
      response: responseText,
      groundingMetadata,
      metadata: {
        modelUsed: model,
        thinkingLevel,
        outputFormat,
      },
    };

  } catch (error: any) {
    logError('search', error);
    throw handleAPIError(error);
  }
}
