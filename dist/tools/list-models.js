/**
 * Tool 8: list_models
 * 列出所有可用的 Gemini 模型
 */
import { getAllModels, getDefaultModel, MODEL_RECOMMENDATIONS } from '../config/models.js';
/**
 * 处理 list_models 请求
 * 返回所有可用模型的详细信息，包括结构化的能力信息
 */
export async function handleListModels() {
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
//# sourceMappingURL=list-models.js.map