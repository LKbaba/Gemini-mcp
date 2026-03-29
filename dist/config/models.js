/**
 * Gemini model configuration
 * Based on official documentation: https://ai.google.dev/gemini-api/docs/models
 * Last updated: March 2026 (v1.3.0 - migrated to Gemini 3.1 Pro Preview)
 */
/**
 * Supported Gemini model list
 * v1.3.0: Added Gemini 3.1 Pro Preview, replacing the retired 3.0 Pro Preview
 */
export const SUPPORTED_MODELS = {
    // v1.3.0: New Gemini 3.1 Pro Preview (default model)
    'gemini-3.1-pro-preview': {
        id: 'gemini-3.1-pro-preview',
        name: 'Gemini 3.1 Pro Preview',
        description: 'Latest Gemini 3.1 model with enhanced reasoning and agentic capabilities',
        contextWindow: 1_048_576, // 1M tokens
        outputLimit: 65_536,
        capabilities: {
            maxInputTokens: 1_048_576,
            maxOutputTokens: 65_536,
            supportsVision: true,
            supportsFunctionCalling: true,
            supportsStreaming: true,
            supportsThinking: true,
            supportsSystemInstructions: true
        },
        features: ['thinking', 'multimodal', 'function_calling', 'grounding', 'system_instructions', 'agentic_reasoning'],
        bestFor: ['UI generation', 'Frontend development', 'Design to code', 'Interactive animations', 'Complex reasoning', 'Agentic workflows'],
        useCases: ['UI generation', 'Frontend development', 'Design to code', 'Interactive animations', 'Complex reasoning', 'Multi-step planning'],
        thinking: true,
        lastUpdate: 'March 2026',
        isDefault: true,
        pricing: {
            inputPerMillion: '$1.25',
            outputPerMillion: '$5.00'
        }
    },
    // v1.3.0: Deprecated (retired 2026-03-09), retained for backward compatibility
    'gemini-3-pro-preview': {
        id: 'gemini-3-pro-preview',
        name: 'Gemini 3.0 Pro Preview',
        description: 'Latest and most powerful model, #1 on WebDev Arena for UI generation',
        contextWindow: 1_048_576, // 1M tokens
        outputLimit: 65_536,
        capabilities: {
            maxInputTokens: 1_048_576,
            maxOutputTokens: 65_536,
            supportsVision: true,
            supportsFunctionCalling: true,
            supportsStreaming: true,
            supportsThinking: true,
            supportsSystemInstructions: true
        },
        features: ['thinking', 'multimodal', 'function_calling', 'grounding', 'system_instructions'],
        bestFor: ['UI generation', 'Frontend development', 'Design to code', 'Interactive animations', 'Complex reasoning'],
        useCases: ['UI generation', 'Frontend development', 'Design to code', 'Interactive animations', 'Complex reasoning'],
        thinking: true,
        lastUpdate: 'January 2026',
        isDefault: false // v1.3.0: No longer the default model
    },
    'gemini-3-flash-preview': {
        id: 'gemini-3-flash-preview',
        name: 'Gemini 3.0 Flash Preview',
        description: 'Fast and efficient 3.0 model with excellent price/performance ratio',
        contextWindow: 1_048_576, // 1M tokens
        outputLimit: 65_536,
        capabilities: {
            maxInputTokens: 1_048_576,
            maxOutputTokens: 65_536,
            supportsVision: true,
            supportsFunctionCalling: true,
            supportsStreaming: true,
            supportsThinking: true,
            supportsSystemInstructions: true
        },
        features: ['thinking', 'multimodal', 'function_calling', 'grounding', 'system_instructions'],
        bestFor: ['Quick Q&A', 'Real-time analysis', 'Batch processing', 'Cost optimization'],
        useCases: ['Quick Q&A', 'Real-time analysis', 'Batch processing', 'Daily coding tasks'],
        thinking: true,
        lastUpdate: 'January 2026',
        isDefault: false
    },
    'gemini-2.5-pro': {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'Stable production model with excellent coding capabilities',
        contextWindow: 1_048_576, // 1M tokens
        outputLimit: 65_536,
        capabilities: {
            maxInputTokens: 1_048_576,
            maxOutputTokens: 65_536,
            supportsVision: true,
            supportsFunctionCalling: true,
            supportsStreaming: true,
            supportsThinking: true,
            supportsSystemInstructions: true
        },
        features: ['thinking', 'multimodal', 'function_calling', 'grounding', 'system_instructions'],
        bestFor: ['General coding', 'Large codebase analysis', 'Fallback option'],
        useCases: ['General coding', 'Large codebase analysis', 'Code review', 'Documentation generation'],
        thinking: true,
        lastUpdate: 'June 2025',
        isDefault: false
    }
};
/**
 * Deprecated model mapping table
 * v1.3.0: Automatically maps old model names to new models for backward compatibility
 *
 * When a user specifies a deprecated model name, the system automatically maps it
 * to the recommended new model and emits a warning log prompting the user to update their config.
 */
export const DEPRECATED_MODEL_MAPPING = {
    'gemini-3-pro-preview': 'gemini-3.1-pro-preview', // deprecated 2026-03-09
};
/**
 * Get default model
 * v1.3.0: Default model updated to gemini-3.1-pro-preview
 */
export function getDefaultModel() {
    return SUPPORTED_MODELS['gemini-3.1-pro-preview'];
}
/**
 * Get model configuration
 * v1.3.0: Enhanced to support automatic deprecated model mapping
 *
 * @param modelId - Model ID
 * @returns Model configuration, returns default model if not found
 */
export function getModelConfig(modelId) {
    if (!modelId) {
        return getDefaultModel();
    }
    // v1.3.0: Check if the model is deprecated and auto-map to new model
    if (modelId in DEPRECATED_MODEL_MAPPING) {
        const newModelId = DEPRECATED_MODEL_MAPPING[modelId];
        console.warn(`[Gemini MCP] Model "${modelId}" is deprecated and will be removed. ` +
            `Automatically using "${newModelId}" instead. ` +
            `Please update your configuration.`);
        return SUPPORTED_MODELS[newModelId] || getDefaultModel();
    }
    return SUPPORTED_MODELS[modelId] || getDefaultModel();
}
/**
 * Validate if model is supported
 * @param modelId - Model ID
 * @returns Whether the model is supported
 */
export function isModelSupported(modelId) {
    return modelId in SUPPORTED_MODELS;
}
/**
 * Get all supported models list
 */
export function getAllModels() {
    return Object.values(SUPPORTED_MODELS);
}
/**
 * Model selection recommendations
 * v1.3.0: Updated Pro-related recommendations to gemini-3.1-pro-preview
 */
export const MODEL_RECOMMENDATIONS = {
    ui_generation: 'gemini-3.1-pro-preview',
    animation: 'gemini-3.1-pro-preview',
    multimodal: 'gemini-3.1-pro-preview',
    codebase_analysis: 'gemini-2.5-pro',
    batch_processing: 'gemini-3-flash-preview',
    quick_tasks: 'gemini-3-flash-preview',
    fallback: 'gemini-2.5-pro'
};
//# sourceMappingURL=models.js.map