/**
 * Tool 8: list_models
 * 列出所有可用的 Gemini 模型
 */

import {
  getAllModels,
  getDefaultModel,
  MODEL_RECOMMENDATIONS,
  ModelConfig,
  ModelCapabilities
} from '../config/models.js';

/**
 * 模型信息输出接口（更结构化）
 */
export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  /** 结构化的能力信息 */
  capabilities: ModelCapabilities;
  /** 推荐使用场景 */
  useCases: string[];
  /** 是否为默认模型 */
  isDefault: boolean;
  /** 支持的功能列表 */
  features: string[];
  /** 最佳适用场景 */
  bestFor: string[];
  /** 最后更新时间 */
  lastUpdate: string;
}

/**
 * list_models 返回结果接口
 */
export interface ListModelsResult {
  /** 所有可用模型 */
  models: ModelInfo[];
  /** 默认模型 ID */
  defaultModel: string;
  /** 模型总数 */
  totalCount: number;
  /** 按场景的模型推荐 */
  recommendations: typeof MODEL_RECOMMENDATIONS;
}

/**
 * 处理 list_models 请求
 * 返回所有可用模型的详细信息，包括结构化的能力信息
 */
export async function handleListModels(): Promise<ListModelsResult> {
  const models = getAllModels();
  const defaultModel = getDefaultModel();

  return {
    models: models.map((model) => ({
      id: model.id,
      name: model.name,
      description: model.description,
      capabilities: model.capabilities,
      useCases: model.useCases,
      isDefault: model.isDefault,
      features: model.features,
      bestFor: model.bestFor,
      lastUpdate: model.lastUpdate
    })),
    defaultModel: defaultModel.id,
    totalCount: models.length,
    recommendations: MODEL_RECOMMENDATIONS
  };
}
