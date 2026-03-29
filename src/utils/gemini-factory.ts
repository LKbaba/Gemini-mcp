/**
 * Gemini AI factory function
 * Creates a GoogleGenAI instance with built-in retry and timeout configuration.
 * Replaces manual retry/timeout dead code with SDK-native support.
 */

import { GoogleGenAI } from '@google/genai';
import { API_CONFIG } from '../config/constants.js';

/**
 * Create a GoogleGenAI instance with retry and timeout configured.
 *
 * Uses SDK built-in httpOptions for:
 * - Timeout: API_CONFIG.timeout (60000ms)
 * - Retry: API_CONFIG.maxRetries + 1 attempts (4 = 1 initial + 3 retries)
 *
 * @param apiKey - Google Gemini API key
 * @returns Configured GoogleGenAI instance
 */
export function createGeminiAI(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: API_CONFIG.timeout,
      retryOptions: {
        attempts: API_CONFIG.maxRetries + 1, // 4 attempts (initial + 3 retries)
      },
    },
  });
}
