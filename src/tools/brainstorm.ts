/**
 * Tool 7: gemini_brainstorm
 * Creative brainstorming tool - Generate creative ideas and solutions
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

// Brainstorming system prompt
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

// Supported model types
type SupportedModel = 'gemini-3-pro-preview' | 'gemini-3-flash-preview';

// Parameter interface
export interface BrainstormParams {
  topic: string;
  context?: string;

  // [NEW] Project context file path
  contextFilePath?: string;

  // [NEW] Multiple context files
  contextFiles?: string[];

  count?: number;
  style?: 'innovative' | 'practical' | 'radical';
  model?: SupportedModel;  // v1.2.0: Model selection parameter
}

// Idea interface
export interface Idea {
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  feasibility: 'low' | 'medium' | 'high';
}

// Return interface
export interface BrainstormResult {
  topic: string;
  style: string;
  ideas: Idea[];
  /** List of context files used for brainstorming */
  contextFilesUsed?: string[];
  metadata?: {
    totalIdeas: number;
    modelUsed: string;
  };
}

/**
 * Build brainstorming prompt
 * @param params Original parameters
 * @param count Number of ideas
 * @param style Style
 * @param projectContext Project context content
 */
function buildBrainstormPrompt(
  params: BrainstormParams,
  count: number,
  style: string,
  projectContext?: string
): string {
  let prompt = `# Brainstorming Session\n\n`;

  prompt += `## Topic\n${params.topic}\n\n`;

  // [NEW] Add project context
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
 * Parse brainstorming response
 */
function parseBrainstormResponse(response: string, expectedCount: number): Idea[] {
  try {
    // Try to extract JSON content (may be wrapped in markdown code blocks)
    let jsonContent = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    // Try to parse directly
    const parsed = JSON.parse(jsonContent);

    if (parsed.ideas && Array.isArray(parsed.ideas)) {
      // Validate and normalize each idea
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

    // If response is in array format
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
    // JSON parsing failed, try to extract ideas from text
  }

  // If JSON parsing fails, create an idea containing the raw response
  return [{
    title: 'Brainstorm Results',
    description: response.substring(0, 500) + (response.length > 500 ? '...' : ''),
    pros: ['See full response for details'],
    cons: ['Response could not be parsed as structured data'],
    feasibility: 'medium'
  }];
}

/**
 * Handle gemini_brainstorm tool invocation
 */
export async function handleBrainstorm(
  params: BrainstormParams,
  client: GeminiClient
): Promise<BrainstormResult> {
  try {
    // Parameter validation
    validateRequired(params.topic, 'topic');
    validateString(params.topic, 'topic', 5);

    if (params.context) {
      validateString(params.context, 'context', 5);
    }

    // Validate optional enum parameters
    const validStyles = ['innovative', 'practical', 'radical'];
    if (params.style && !validStyles.includes(params.style)) {
      throw new Error(`Invalid style: ${params.style}. Must be one of: ${validStyles.join(', ')}`);
    }

    // Validate count parameter
    if (params.count !== undefined) {
      validateNumber(params.count, 'count', 1, 20);
    }

    // Set default values
    const count = params.count || 5;
    const style = params.style || 'innovative';

    // [NEW] Read project context files
    let projectContext = '';
    const contextFilesUsed: string[] = [];

    // Read single context file
    if (params.contextFilePath) {
      try {
        const fileContent = await readFile(params.contextFilePath);
        contextFilesUsed.push(fileContent.path);
        projectContext += `### ${fileContent.path}\n`;
        projectContext += fileContent.content + '\n\n';
      } catch (error) {
        logError('brainstorm:readContextFilePath', error);
        // Continue execution without interrupting
      }
    }

    // Read multiple context files
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
        // Continue execution without interrupting
      }
    }

    // Build prompt (with project context)
    const prompt = buildBrainstormPrompt(
      params,
      count,
      style,
      projectContext || undefined
    );

    // v1.2.0: Use user-selected model (default: gemini-3-pro-preview)
    const modelToUse = params.model || 'gemini-3-pro-preview';
    client.setModel(modelToUse);

    // Call Gemini API
    const response = await client.generate(prompt, {
      systemInstruction: BRAINSTORM_SYSTEM_PROMPT,
      temperature: style === 'radical' ? 0.9 : (style === 'innovative' ? 0.8 : 0.6),
      maxTokens: 8192
    });

    // Parse response
    const ideas = parseBrainstormResponse(response, count);

    // Build return result
    return {
      topic: params.topic,
      style: style,
      ideas: ideas,
      // [NEW] Return used context files
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
