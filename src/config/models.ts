/**
 * Gemini 模型配置
 * 基于官方文档: https://ai.google.dev/gemini-api/docs/models
 * 最后更新: 2025年11月
 */

/**
 * 模型能力详情接口
 */
export interface ModelCapabilities {
  /** 最大输入 token 数 */
  maxInputTokens: number;
  /** 最大输出 token 数 */
  maxOutputTokens: number;
  /** 是否支持图像/视频输入 */
  supportsVision: boolean;
  /** 是否支持函数调用 */
  supportsFunctionCalling: boolean;
  /** 是否支持流式输出 */
  supportsStreaming: boolean;
  /** 是否支持思维链 */
  supportsThinking: boolean;
  /** 是否支持系统指令 */
  supportsSystemInstructions: boolean;
}

/**
 * 模型定价信息（可选）
 */
export interface ModelPricing {
  /** 输入每百万 token 价格 */
  inputPerMillion: string;
  /** 输出每百万 token 价格 */
  outputPerMillion: string;
}

export interface ModelConfig {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  outputLimit: number;
  /** 【新增】结构化能力信息 */
  capabilities: ModelCapabilities;
  features: string[];
  bestFor: string[];
  /** 推荐使用场景（中文） */
  useCases: string[];
  thinking: boolean;
  lastUpdate: string;
  isDefault: boolean;
  /** 【新增】定价信息（可选） */
  pricing?: ModelPricing;
}

/**
 * 支持的 Gemini 模型列表
 * 精选4个模型，专注于UI生成和前端开发
 */
export const SUPPORTED_MODELS: Record<string, ModelConfig> = {
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
export function getDefaultModel(): ModelConfig {
  return SUPPORTED_MODELS['gemini-3-pro-preview'];
}

/**
 * 获取模型配置
 * @param modelId - 模型ID
 * @returns 模型配置，如果不存在则返回默认模型
 */
export function getModelConfig(modelId?: string): ModelConfig {
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
export function isModelSupported(modelId: string): boolean {
  return modelId in SUPPORTED_MODELS;
}

/**
 * 获取所有支持的模型列表
 */
export function getAllModels(): ModelConfig[] {
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
