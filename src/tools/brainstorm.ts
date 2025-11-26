/**
 * Tool 7: gemini_brainstorm
 * 创意头脑风暴工具 - 生成创意想法和解决方案
 * Priority: P2 - Phase 4
 */

import { GeminiClient } from '../utils/gemini-client.js';
import {
  validateRequired,
  validateString,
  validateNumber
} from '../utils/validators.js';
import { handleAPIError, logError } from '../utils/error-handler.js';
import { readFile, readFiles, FileContent } from '../utils/file-reader.js';

// 头脑风暴系统提示词
const BRAINSTORM_SYSTEM_PROMPT = `You are a creative innovation consultant with expertise in:
- Product ideation and design thinking
- Problem-solving and lateral thinking
- Technology trends and market analysis
- Business strategy and innovation

Brainstorming approach:
1. Understand the topic and context deeply
2. Generate diverse ideas across different dimensions
3. Evaluate each idea objectively
4. Provide actionable details

Idea generation styles:
- Innovative: Push boundaries, explore emerging technologies
- Practical: Focus on feasibility and immediate implementation
- Radical: Challenge assumptions, think unconventionally

For each idea, provide:
- Clear, descriptive title
- Detailed description of the concept
- Pros: Benefits and advantages
- Cons: Challenges and limitations
- Feasibility: Realistic assessment (low/medium/high)

Quality requirements:
- Each idea should be distinct and valuable
- Balance creativity with practicality
- Consider technical, business, and user perspectives
- Provide specific, actionable suggestions`;

// 参数接口
export interface BrainstormParams {
  topic: string;
  context?: string;

  // 【新增】项目上下文文件路径
  contextFilePath?: string;

  // 【新增】多个上下文文件
  contextFiles?: string[];

  count?: number;
  style?: 'innovative' | 'practical' | 'radical';
}

// 想法接口
export interface Idea {
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  feasibility: 'low' | 'medium' | 'high';
}

// 返回接口
export interface BrainstormResult {
  topic: string;
  style: string;
  ideas: Idea[];
  /** 用于头脑风暴的上下文文件列表 */
  contextFilesUsed?: string[];
  metadata?: {
    totalIdeas: number;
    modelUsed: string;
  };
}

/**
 * 构建头脑风暴提示词
 * @param params 原始参数
 * @param count 想法数量
 * @param style 风格
 * @param projectContext 项目上下文内容
 */
function buildBrainstormPrompt(
  params: BrainstormParams,
  count: number,
  style: string,
  projectContext?: string
): string {
  let prompt = `# Brainstorming Session\n\n`;

  prompt += `## Topic\n${params.topic}\n\n`;

  // 【新增】添加项目上下文
  if (projectContext) {
    prompt += `## Project Background\n${projectContext}\n`;
    prompt += `**Important**: Please ensure your ideas are compatible with the project's architecture and tech stack.\n\n`;
  }

  if (params.context) {
    prompt += `## Additional Context\n${params.context}\n\n`;
  }

  prompt += `## Requirements\n`;
  prompt += `- Generate exactly ${count} distinct ideas\n`;
  prompt += `- Style: ${style}\n\n`;

  prompt += `## Style Guidelines\n`;
  switch (style) {
    case 'innovative':
      prompt += `Focus on innovation:
- Leverage emerging technologies (AI, blockchain, IoT, etc.)
- Explore new business models
- Consider future trends
- Push beyond conventional solutions\n\n`;
      break;
    case 'practical':
      prompt += `Focus on practicality:
- Prioritize quick implementation
- Use proven technologies
- Consider resource constraints
- Focus on immediate impact\n\n`;
      break;
    case 'radical':
      prompt += `Focus on radical thinking:
- Challenge all assumptions
- Explore completely new approaches
- Don't be limited by current constraints
- Think 10x, not 10%\n\n`;
      break;
  }

  prompt += `## Output Format
Provide your response as valid JSON with this exact structure:
{
  "ideas": [
    {
      "title": "Clear, descriptive title",
      "description": "Detailed description of the idea (2-3 sentences)",
      "pros": ["benefit 1", "benefit 2", "benefit 3"],
      "cons": ["challenge 1", "challenge 2"],
      "feasibility": "low" | "medium" | "high"
    }
  ]
}

Important:
- Return ONLY valid JSON, no additional text
- Each idea must have all required fields
- Pros and cons should be specific and meaningful
- Feasibility should reflect realistic assessment`;

  return prompt;
}

/**
 * 解析头脑风暴响应
 */
function parseBrainstormResponse(response: string, expectedCount: number): Idea[] {
  try {
    // 尝试提取 JSON 内容（可能被包裹在 markdown 代码块中）
    let jsonContent = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    // 尝试直接解析
    const parsed = JSON.parse(jsonContent);

    if (parsed.ideas && Array.isArray(parsed.ideas)) {
      // 验证并规范化每个想法
      return parsed.ideas.map((idea: any, index: number) => ({
        title: idea.title || `Idea ${index + 1}`,
        description: idea.description || 'No description provided',
        pros: Array.isArray(idea.pros) ? idea.pros : ['Not specified'],
        cons: Array.isArray(idea.cons) ? idea.cons : ['Not specified'],
        feasibility: ['low', 'medium', 'high'].includes(idea.feasibility)
          ? idea.feasibility
          : 'medium'
      }));
    }

    // 如果响应是数组格式
    if (Array.isArray(parsed)) {
      return parsed.map((idea: any, index: number) => ({
        title: idea.title || `Idea ${index + 1}`,
        description: idea.description || 'No description provided',
        pros: Array.isArray(idea.pros) ? idea.pros : ['Not specified'],
        cons: Array.isArray(idea.cons) ? idea.cons : ['Not specified'],
        feasibility: ['low', 'medium', 'high'].includes(idea.feasibility)
          ? idea.feasibility
          : 'medium'
      }));
    }
  } catch {
    // JSON 解析失败，尝试从文本中提取想法
  }

  // 如果 JSON 解析失败，创建一个包含原始响应的想法
  return [{
    title: 'Brainstorm Results',
    description: response.substring(0, 500) + (response.length > 500 ? '...' : ''),
    pros: ['See full response for details'],
    cons: ['Response could not be parsed as structured data'],
    feasibility: 'medium'
  }];
}

/**
 * 处理 gemini_brainstorm 工具调用
 */
export async function handleBrainstorm(
  params: BrainstormParams,
  client: GeminiClient
): Promise<BrainstormResult> {
  try {
    // 参数验证
    validateRequired(params.topic, 'topic');
    validateString(params.topic, 'topic', 5);

    if (params.context) {
      validateString(params.context, 'context', 5);
    }

    // 验证可选枚举参数
    const validStyles = ['innovative', 'practical', 'radical'];
    if (params.style && !validStyles.includes(params.style)) {
      throw new Error(`Invalid style: ${params.style}. Must be one of: ${validStyles.join(', ')}`);
    }

    // 验证 count 参数
    if (params.count !== undefined) {
      validateNumber(params.count, 'count', 1, 20);
    }

    // 设置默认值
    const count = params.count || 5;
    const style = params.style || 'innovative';

    // 【新增】读取项目上下文文件
    let projectContext = '';
    const contextFilesUsed: string[] = [];

    // 读取单个上下文文件
    if (params.contextFilePath) {
      try {
        const fileContent = await readFile(params.contextFilePath);
        contextFilesUsed.push(fileContent.path);
        projectContext += `### ${fileContent.path}\n`;
        projectContext += fileContent.content + '\n\n';
      } catch (error) {
        logError('brainstorm:readContextFilePath', error);
        // 继续执行，不中断
      }
    }

    // 读取多个上下文文件
    if (params.contextFiles && params.contextFiles.length > 0) {
      try {
        const contextContents = await readFiles(params.contextFiles);
        for (const file of contextContents) {
          contextFilesUsed.push(file.path);
          projectContext += `### ${file.path}\n`;
          projectContext += file.content + '\n\n';
        }
      } catch (error) {
        logError('brainstorm:readContextFiles', error);
        // 继续执行，不中断
      }
    }

    // 构建提示词（传入项目上下文）
    const prompt = buildBrainstormPrompt(
      params,
      count,
      style,
      projectContext || undefined
    );

    // 调用 Gemini API（使用默认模型 gemini-3-pro-preview）
    const response = await client.generate(prompt, {
      systemInstruction: BRAINSTORM_SYSTEM_PROMPT,
      temperature: style === 'radical' ? 0.9 : (style === 'innovative' ? 0.8 : 0.6),
      maxTokens: 8192
    });

    // 解析响应
    const ideas = parseBrainstormResponse(response, count);

    // 构建返回结果
    return {
      topic: params.topic,
      style: style,
      ideas: ideas,
      // 【新增】返回使用的上下文文件
      contextFilesUsed: contextFilesUsed.length > 0 ? contextFilesUsed : undefined,
      metadata: {
        totalIdeas: ideas.length,
        modelUsed: client.getModel()
      }
    };

  } catch (error: any) {
    logError('brainstorm', error);
    throw handleAPIError(error);
  }
}
