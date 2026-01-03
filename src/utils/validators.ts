/**
 * Parameter validation utilities
 */

import {
  FRAMEWORKS,
  // ANIMATION_TECHNOLOGIES removed - animation tool has been removed
  UI_STYLES,
  OUTPUT_FORMATS,
  CONTENT_TYPES,
  ANALYSIS_TASKS,
  CODEBASE_FOCUS,
  BRAINSTORM_STYLES
} from '../config/constants.js';
import { isModelSupported } from '../config/models.js';

/**
 * Validate required parameter
 */
export function validateRequired(value: any, fieldName: string): void {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${fieldName} is required`);
  }
}

/**
 * Validate string
 */
export function validateString(value: any, fieldName: string, minLength = 1): void {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  if (value.length < minLength) {
    throw new Error(`${fieldName} must be at least ${minLength} characters long`);
  }
}

/**
 * Validate number
 */
export function validateNumber(value: any, fieldName: string, min?: number, max?: number): void {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error(`${fieldName} must be a number`);
  }
  if (min !== undefined && value < min) {
    throw new Error(`${fieldName} must be at least ${min}`);
  }
  if (max !== undefined && value > max) {
    throw new Error(`${fieldName} must be at most ${max}`);
  }
}

/**
 * Validate boolean
 */
export function validateBoolean(value: any, fieldName: string): void {
  if (typeof value !== 'boolean') {
    throw new Error(`${fieldName} must be a boolean`);
  }
}

/**
 * Validate enum value
 */
export function validateEnum<T extends readonly string[]>(
  value: any,
  fieldName: string,
  allowedValues: T
): void {
  if (!allowedValues.includes(value)) {
    throw new Error(
      `${fieldName} must be one of: ${allowedValues.join(', ')}. Got: ${value}`
    );
  }
}

/**
 * Validate array
 */
export function validateArray(value: any, fieldName: string, minLength = 1): void {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array`);
  }
  if (value.length < minLength) {
    throw new Error(`${fieldName} must have at least ${minLength} item(s)`);
  }
}

/**
 * Validate Base64 image
 */
export function validateBase64Image(value: string, fieldName: string): void {
  if (!value.startsWith('data:image/')) {
    throw new Error(`${fieldName} must be a Base64 encoded image (data:image/...)`);
  }
}

/**
 * Validate URL
 */
export function validateURL(value: string, fieldName: string): void {
  try {
    new URL(value);
  } catch {
    throw new Error(`${fieldName} must be a valid URL`);
  }
}

/**
 * Validate framework
 */
export function validateFramework(value: string): void {
  validateEnum(value, 'framework', FRAMEWORKS);
}

// validateAnimationTechnology removed - animation tool has been removed

/**
 * Validate UI style
 */
export function validateUIStyle(value: string): void {
  validateEnum(value, 'style', UI_STYLES);
}

/**
 * Validate output format
 */
export function validateOutputFormat(value: string): void {
  validateEnum(value, 'outputFormat', OUTPUT_FORMATS);
}

/**
 * Validate content type
 */
export function validateContentType(value: string): void {
  validateEnum(value, 'type', CONTENT_TYPES);
}

/**
 * Validate analysis task
 */
export function validateAnalysisTask(value: string): void {
  validateEnum(value, 'task', ANALYSIS_TASKS);
}

/**
 * Validate codebase focus
 */
export function validateCodebaseFocus(value: string): void {
  validateEnum(value, 'focus', CODEBASE_FOCUS);
}

/**
 * Validate brainstorm style
 */
export function validateBrainstormStyle(value: string): void {
  validateEnum(value, 'style', BRAINSTORM_STYLES);
}

/**
 * Validate model ID
 */
export function validateModel(modelId: string): void {
  if (!isModelSupported(modelId)) {
    throw new Error(
      `Model "${modelId}" is not supported. Use one of: gemini-3-pro-preview, gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite`
    );
  }
}

/**
 * Validate temperature parameter
 */
export function validateTemperature(temperature: number): void {
  validateNumber(temperature, 'temperature', 0, 2);
}

/**
 * Validate maxTokens parameter
 */
export function validateMaxTokens(maxTokens: number): void {
  validateNumber(maxTokens, 'maxTokens', 1, 65536);
}
