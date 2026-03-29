/**
 * Custom error classes for distinguishing validation/security errors from API errors.
 *
 * Usage in tool catch blocks:
 *   - ValidationError / SecurityError → handleValidationError() → INVALID_PARAMS (-32602)
 *   - Other errors → handleAPIError() → API_ERROR (-32000)
 */

/**
 * Validation error — thrown when user input fails validation
 * (missing parameters, invalid values, file not found, etc.)
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Re-export SecurityError from the security module to provide a unified import path.
// SecurityError is thrown when path traversal or sensitive file access is detected.
export { SecurityError } from './security.js';
