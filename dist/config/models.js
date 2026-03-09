/**
 * Gemini model configuration
 * Based on official documentation: https://ai.google.dev/gemini-api/docs/models
 * Last updated: March 2026 (v1.3.0 - 迁移到 Gemini 3.1 Pro Preview)
 */
/**
 * Supported Gemini model list
 * v1.3.0: 添加 Gemini 3.1 Pro Preview，替代已退役的 3.0 Pro Preview
 */
export const SUPPORTED_MODELS = {
    // v1.3.0: 新增 Gemini 3.1 Pro Preview（默认模型）
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
    // v1.3.0: 已废弃（2026-03-09 退役），保留以支持向后兼容
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
        isDefault: false // v1.3.0: 不再是默认模型
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
 * 废弃模型映射表
 * v1.3.0: 自动将旧模型名称映射到新模型，保证向后兼容
 *
 * 当用户使用已废弃的模型名称时，系统会自动映射到推荐的新模型，
 * 并输出警告日志提示用户更新配置。
 */
export const DEPRECATED_MODEL_MAPPING = {
    'gemini-3-pro-preview': 'gemini-3.1-pro-preview', // 2026-03-09 退役
};
/**
 * Get default model
 * v1.3.0: 默认模型更新为 gemini-3.1-pro-preview
 */
export function getDefaultModel() {
    return SUPPORTED_MODELS['gemini-3.1-pro-preview'];
}
/**
 * Get model configuration
 * v1.3.0: 增强支持废弃模型自动映射
 *
 * @param modelId - Model ID
 * @returns Model configuration, returns default model if not found
 */
export function getModelConfig(modelId) {
    if (!modelId) {
        return getDefaultModel();
    }
    // v1.3.0: 检查是否为废弃模型，自动映射到新模型
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
 * v1.3.0: 更新 Pro 相关推荐为 gemini-3.1-pro-preview
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