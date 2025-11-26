/**
 * Gemini 模型配置
 * 基于官方文档: https://ai.google.dev/gemini-api/docs/models
 * 最后更新: 2025年11月
 */
/**
 * 支持的 Gemini 模型列表
 * 精选4个模型，专注于UI生成和前端开发
 */
export const SUPPORTED_MODELS = {
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
        useCases: ['UI 生成', '前端开发', '设计稿转代码', '交互动画', '复杂推理'],
        thinking: true,
        lastUpdate: 'November 2025',
        isDefault: true
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
        useCases: ['通用编码', '大型代码库分析', '代码审查', '文档生成'],
        thinking: true,
        lastUpdate: 'June 2025',
        isDefault: false
    },
    'gemini-2.5-flash': {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Fast and cost-effective model with best price/performance ratio',
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
        bestFor: ['High-frequency tasks', 'Batch processing', 'Cost optimization'],
        useCases: ['快速问答', '实时分析', '批量处理', '成本优化'],
        thinking: true,
        lastUpdate: 'June 2025',
        isDefault: false
    },
    'gemini-2.5-flash-lite': {
        id: 'gemini-2.5-flash-lite',
        name: 'Gemini 2.5 Flash Lite',
        description: 'Ultra-fast and most cost-efficient model for simple tasks',
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
        features: ['thinking', 'multimodal', 'function_calling', 'system_instructions'],
        bestFor: ['Simple queries', 'Quick prototypes', 'Maximum cost savings'],
        useCases: ['简单查询', '快速验证', '低延迟场景', '最大成本节省'],
        thinking: true,
        lastUpdate: 'July 2025',
        isDefault: false
    }
};
/**
 * 获取默认模型
 */
export function getDefaultModel() {
    return SUPPORTED_MODELS['gemini-3-pro-preview'];
}
/**
 * 获取模型配置
 * @param modelId - 模型ID
 * @returns 模型配置，如果不存在则返回默认模型
 */
export function getModelConfig(modelId) {
    if (!modelId) {
        return getDefaultModel();
    }
    return SUPPORTED_MODELS[modelId] || getDefaultModel();
}
/**
 * 验证模型是否支持
 * @param modelId - 模型ID
 * @returns 是否支持该模型
 */
export function isModelSupported(modelId) {
    return modelId in SUPPORTED_MODELS;
}
/**
 * 获取所有支持的模型列表
 */
export function getAllModels() {
    return Object.values(SUPPORTED_MODELS);
}
/**
 * 模型选择建议
 */
export const MODEL_RECOMMENDATIONS = {
    ui_generation: 'gemini-3-pro-preview',
    animation: 'gemini-3-pro-preview',
    multimodal: 'gemini-3-pro-preview',
    codebase_analysis: 'gemini-2.5-pro',
    batch_processing: 'gemini-2.5-flash',
    simple_tasks: 'gemini-2.5-flash-lite',
    fallback: 'gemini-2.5-pro'
};
//# sourceMappingURL=models.js.map