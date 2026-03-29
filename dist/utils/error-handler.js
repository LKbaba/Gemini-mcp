/**
 * Error handling utilities
 *
 * Bug fixes in v1.3.1:
 * - Bug1: Precise model error matching (replaces overly broad 'model'/'not found' checks)
 * - Bug7: MCPError is now a proper Error subclass (has stack trace, instanceof works)
 * - Bug8: Enhanced sensitive info sanitization (URL keys, Bearer tokens, raw API keys)
 */
import { ERROR_CODES } from '../config/constants.js';
import { MCPError } from '../types.js';
/**
 * Create MCP error object (now returns MCPError class instance)
 */
export function createMCPError(code, message, data) {
    return new MCPError(code, message, data);
}
/**
 * Handle API errors — maps Gemini/network errors to MCP error codes.
 * All branches now pass through the original error.message for transparency.
 */
export function handleAPIError(error) {
    const msg = error.message || 'An error occurred while calling the Gemini API.';
    // API Key error
    if (msg.includes('API key') || msg.includes('Invalid key')) {
        return createMCPError(ERROR_CODES.API_ERROR, `Invalid API key: ${msg}`, { originalError: msg });
    }
    // Quota / rate limit error
    if (msg.includes('quota') || msg.includes('rate limit')) {
        return createMCPError(ERROR_CODES.RATE_LIMIT, `Rate limit or quota exceeded: ${msg}`, { originalError: msg });
    }
    // Timeout error
    if (msg.includes('timeout')) {
        return createMCPError(ERROR_CODES.TIMEOUT, `Request timeout: ${msg}`, { originalError: msg });
    }
    // Model not supported — precise matching (Bug1 fix)
    // Only match Google API model-specific error patterns, not generic "not found"
    if (msg.includes('models/') || // "models/gemini-xxx is not found"
        msg.includes('not supported for model') || // "feature not supported for model"
        msg.includes('Model not found') || // Google API standard error
        msg.includes('model is not available') || // model unavailable
        error.status === 404 // HTTP 404
    ) {
        return createMCPError(ERROR_CODES.MODEL_NOT_SUPPORTED, `Model unavailable: ${msg}`, { originalError: msg, statusCode: error.status });
    }
    // Generic API error — pass through original message
    return createMCPError(ERROR_CODES.API_ERROR, msg, { originalError: msg });
}
/**
 * Handle parameter validation errors
 */
export function handleValidationError(message, details) {
    return createMCPError(ERROR_CODES.INVALID_PARAMS, message, details);
}
/**
 * Handle internal errors
 */
export function handleInternalError(error) {
    return createMCPError(ERROR_CODES.INTERNAL_ERROR, 'Internal server error', { originalError: error.message });
}
/**
 * Sanitize error message — prevent sensitive information leakage (Bug8 fix)
 *
 * Cleans 4 types of sensitive data:
 * 1. apiKey=xxx query parameters
 * 2. ?key=AIzaSy... or &key=... in URLs
 * 3. Bearer tokens
 * 4. Raw Google API keys (AIzaSy... format)
 */
export function sanitizeErrorMessage(error) {
    const msg = typeof error === 'string' ? error : error?.message || 'Unknown error';
    return msg
        .replace(/apiKey\s*=\s*[^\s]+/gi, 'apiKey=***')
        .replace(/[?&]key=[A-Za-z0-9_-]+/gi, '?key=***')
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***')
        .replace(/AIzaSy[A-Za-z0-9_-]{33}/g, 'AIza***');
}
/**
 * Log error (for debugging)
 */
export function logError(context, error) {
    const timestamp = new Date().toISOString();
    const sanitized = sanitizeErrorMessage(error);
    console.error(`[${timestamp}] [${context}] Error:`, sanitized);
    if (error.stack) {
        console.error('Stack trace:', error.stack);
    }
}
//# sourceMappingURL=error-handler.js.map