/**
 * Gemini API client wrapper
 * Provides unified API interface with error handling and retry logic
 */
import { GoogleGenAI } from '@google/genai';
import { API_CONFIG } from '../config/constants.js';
import * as fs from 'fs';
import * as path from 'path';
/**
 * Get MIME type based on file extension
 */
function getMimeType(ext) {
    const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
    };
    return mimeTypes[ext.toLowerCase()] || 'image/png';
}
/**
 * Convert image to Base64 inline data format
 * Supports: file path, Base64 data URI
 */
export function convertImageToInlineData(image) {
    // 1. Already in Base64 data URI format
    if (image.startsWith('data:')) {
        const [metadata, data] = image.split(',');
        const mimeType = metadata.match(/:(.*?);/)?.[1] || 'image/png';
        return { mimeType, data };
    }
    // 2. URL format - not supported
    if (image.startsWith('http://') || image.startsWith('https://')) {
        throw new Error(`URL images are not supported. Please provide a file path or Base64 data URI instead.`);
    }
    // 3. File path format - read file and convert to Base64
    try {
        // Check if file exists
        if (!fs.existsSync(image)) {
            throw new Error(`Image file not found: ${image}`);
        }
        // Read file and convert to Base64
        const fileBuffer = fs.readFileSync(image);
        const base64Data = fileBuffer.toString('base64');
        // Get MIME type
        const ext = path.extname(image);
        const mimeType = getMimeType(ext);
        return { mimeType, data: base64Data };
    }
    catch (error) {
        if (error.message.includes('Image file not found')) {
            throw error;
        }
        throw new Error(`Failed to read image file "${image}": ${error.message}`);
    }
}
export class GeminiClient {
    client;
    modelId;
    config;
    constructor(config) {
        this.client = new GoogleGenAI({ apiKey: config.apiKey });
        this.modelId = config.model || 'gemini-3-pro-preview';
        this.config = {
            apiKey: config.apiKey,
            model: this.modelId,
            timeout: config.timeout || API_CONFIG.timeout,
            maxRetries: config.maxRetries || API_CONFIG.maxRetries
        };
    }
    /**
     * Generate content (text only)
     */
    async generate(prompt, options = {}) {
        try {
            const requestBody = {
                model: this.modelId,
                contents: [{
                        role: 'user',
                        parts: [{ text: prompt }]
                    }],
                generationConfig: {
                    temperature: options.temperature,
                    maxOutputTokens: options.maxTokens,
                    topP: options.topP,
                    topK: options.topK
                }
            };
            // Add system instruction (if provided)
            if (options.systemInstruction) {
                requestBody.systemInstruction = {
                    parts: [{ text: options.systemInstruction }]
                };
            }
            const result = await this.client.models.generateContent(requestBody);
            return result.text || '';
        }
        catch (error) {
            throw this.handleError(error);
        }
    }
    /**
     * Generate content (multimodal: text + images)
     * Supported image formats:
     * - File path: e.g., "./images/screenshot.png"
     * - Base64 data URI: e.g., "data:image/png;base64,iVBORw0KGgo..."
     */
    async generateMultimodal(prompt, images, options = {}) {
        try {
            // Build content: text + images
            const parts = [{ text: prompt }];
            // Process each image (supports file path and Base64)
            for (const image of images) {
                const { mimeType, data } = convertImageToInlineData(image);
                parts.push({
                    inlineData: {
                        mimeType,
                        data
                    }
                });
            }
            const requestBody = {
                model: this.modelId,
                contents: [{ role: 'user', parts }],
                generationConfig: {
                    temperature: options.temperature,
                    maxOutputTokens: options.maxTokens,
                    topP: options.topP,
                    topK: options.topK
                }
            };
            // Add system instruction (if provided)
            if (options.systemInstruction) {
                requestBody.systemInstruction = {
                    parts: [{ text: options.systemInstruction }]
                };
            }
            const result = await this.client.models.generateContent(requestBody);
            return result.text || '';
        }
        catch (error) {
            throw this.handleError(error);
        }
    }
    /**
     * Switch model
     */
    setModel(modelId) {
        this.modelId = modelId;
        this.config.model = modelId;
    }
    /**
     * Get current model
     */
    getModel() {
        return this.modelId;
    }
    /**
     * Error handling
     */
    handleError(error) {
        if (error.message?.includes('API key')) {
            return new Error('Invalid API key');
        }
        if (error.message?.includes('quota')) {
            return new Error('API quota exceeded');
        }
        if (error.message?.includes('timeout')) {
            return new Error('Request timeout');
        }
        return new Error(error.message || 'Unknown error');
    }
}
/**
 * Create Gemini client instance
 */
export function createGeminiClient(apiKey, model) {
    return new GeminiClient({ apiKey, model });
}
//# sourceMappingURL=gemini-client.js.map