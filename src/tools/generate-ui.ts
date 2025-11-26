/**
 * Tool 1: gemini_generate_ui
 * Generate HTML/CSS/JavaScript UI components from description or design image
 * Priority: P0 - Core functionality
 */

import { GeminiClient } from '../utils/gemini-client.js';
import {
  validateRequired,
  validateString,
  validateFramework,
  validateUIStyle,
  validateBoolean
} from '../utils/validators.js';
import { handleAPIError, logError } from '../utils/error-handler.js';
import { readFile } from '../utils/file-reader.js';

// System prompt for UI generation
const UI_GENERATION_SYSTEM_PROMPT = `You are an expert frontend developer specializing in UI/UX implementation.

Your strengths:
- Converting design mockups into pixel-perfect HTML/CSS/JavaScript
- Creating smooth animations and transitions
- Writing clean, semantic, accessible HTML
- Implementing responsive layouts (mobile-first approach)
- Adding interactive JavaScript with modern ES6+ syntax

Output requirements:
1. Return ONLY complete, working code
2. For vanilla HTML:
   - Use inline <style> tags with organized CSS
   - Use inline <script> tags with modern JavaScript
   - Include all necessary HTML structure
3. For React/Vue/Svelte:
   - Return component code with all imports
   - Use modern hooks/composition API
   - Include prop types and documentation
4. Make it production-ready:
   - Semantic HTML5 elements
   - Accessible (ARIA labels, keyboard navigation)
   - Responsive (mobile, tablet, desktop)
   - Smooth animations (CSS transitions/keyframes)
5. Code quality:
   - No explanations unless explicitly asked
   - Well-organized and commented
   - Follow best practices and conventions

When given a design image:
- Match colors, spacing, typography exactly
- Implement all visible hover states and interactions
- Ensure pixel-perfect accuracy
- Infer missing details intelligently

When given only description:
- Create a beautiful, modern design
- Use current design trends (2025)
- Choose appropriate color schemes
- Add delightful micro-interactions`;

/**
 * 技术栈上下文接口
 * 用于指定生成代码应该使用的技术栈
 */
export interface TechContext {
  /** CSS 框架，如 tailwind、bootstrap 等 */
  cssFramework?: 'tailwind' | 'bootstrap' | 'styled-components' | 'css-modules' | 'emotion';
  /** UI 组件库，如 shadcn、antd 等 */
  uiLibrary?: 'shadcn' | 'antd' | 'mui' | 'chakra' | 'radix';
  /** 是否使用 TypeScript */
  typescript?: boolean;
  /** 状态管理库 */
  stateManagement?: 'zustand' | 'redux' | 'jotai' | 'recoil';
}

export interface GenerateUIParams {
  description: string;
  designImage?: string;
  framework?: 'vanilla' | 'react' | 'vue' | 'svelte';
  includeAnimation?: boolean;
  responsive?: boolean;
  style?: 'modern' | 'minimal' | 'glassmorphism' | 'neumorphism';

  // 【新增】技术栈上下文
  techContext?: TechContext;

  // 【新增】配置文件路径，自动检测技术栈
  configPath?: string;
}

export interface GenerateUIResult {
  code: string;
  framework: string;
  files?: Record<string, string>;
  preview?: string;
  /** 检测到的技术栈信息 */
  detectedTechContext?: TechContext;
}

/**
 * 根据技术栈上下文构建额外的提示词
 * @param techContext 技术栈上下文
 * @returns 技术栈相关的提示词
 */
function buildTechContextPrompt(techContext: TechContext): string {
  const parts: string[] = [];
  parts.push('\n## 技术栈要求\n');

  if (techContext.cssFramework) {
    switch (techContext.cssFramework) {
      case 'tailwind':
        parts.push('- CSS 框架: 使用 Tailwind CSS 类名，不要写原生 CSS 样式，使用 Tailwind 的响应式前缀（sm:, md:, lg:）\n');
        break;
      case 'bootstrap':
        parts.push('- CSS 框架: 使用 Bootstrap 类名和组件\n');
        break;
      case 'styled-components':
        parts.push('- CSS 框架: 使用 styled-components，创建样式化组件\n');
        break;
      case 'css-modules':
        parts.push('- CSS 框架: 使用 CSS Modules，创建 .module.css 文件\n');
        break;
      case 'emotion':
        parts.push('- CSS 框架: 使用 Emotion，使用 css prop 或 styled API\n');
        break;
    }
  }

  if (techContext.uiLibrary) {
    switch (techContext.uiLibrary) {
      case 'shadcn':
        parts.push('- UI 组件库: 使用 shadcn/ui 组件，遵循 shadcn 的命名规范和结构，从 @/components/ui 导入\n');
        break;
      case 'antd':
        parts.push('- UI 组件库: 使用 Ant Design 组件，从 antd 导入\n');
        break;
      case 'mui':
        parts.push('- UI 组件库: 使用 Material-UI (MUI) 组件，从 @mui/material 导入\n');
        break;
      case 'chakra':
        parts.push('- UI 组件库: 使用 Chakra UI 组件，从 @chakra-ui/react 导入\n');
        break;
      case 'radix':
        parts.push('- UI 组件库: 使用 Radix UI 原语组件，从 @radix-ui 导入\n');
        break;
    }
  }

  if (techContext.typescript) {
    parts.push('- 语言: 使用 TypeScript，添加完整的类型定义和 Props 接口\n');
  }

  if (techContext.stateManagement) {
    switch (techContext.stateManagement) {
      case 'zustand':
        parts.push('- 状态管理: 如需要状态管理，使用 Zustand\n');
        break;
      case 'redux':
        parts.push('- 状态管理: 如需要状态管理，使用 Redux Toolkit\n');
        break;
      case 'jotai':
        parts.push('- 状态管理: 如需要状态管理，使用 Jotai\n');
        break;
      case 'recoil':
        parts.push('- 状态管理: 如需要状态管理，使用 Recoil\n');
        break;
    }
  }

  return parts.join('');
}

/**
 * 从 package.json 自动检测技术栈
 * @param configPath package.json 文件路径
 * @returns 检测到的技术栈上下文
 */
async function detectTechStackFromConfig(configPath: string): Promise<TechContext> {
  try {
    const fileContent = await readFile(configPath);
    const pkg = JSON.parse(fileContent.content);
    const deps: Record<string, string> = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {})
    };

    const techContext: TechContext = {};

    // 检测 CSS 框架
    if (deps['tailwindcss']) {
      techContext.cssFramework = 'tailwind';
    } else if (deps['bootstrap'] || deps['react-bootstrap']) {
      techContext.cssFramework = 'bootstrap';
    } else if (deps['styled-components']) {
      techContext.cssFramework = 'styled-components';
    } else if (deps['@emotion/react'] || deps['@emotion/styled']) {
      techContext.cssFramework = 'emotion';
    }

    // 检测 UI 库（注意：shadcn 通常不在 dependencies 中，而是通过 class-variance-authority 检测）
    if (deps['class-variance-authority'] || deps['@radix-ui/react-dialog']) {
      techContext.uiLibrary = 'shadcn';
    } else if (deps['antd']) {
      techContext.uiLibrary = 'antd';
    } else if (deps['@mui/material']) {
      techContext.uiLibrary = 'mui';
    } else if (deps['@chakra-ui/react']) {
      techContext.uiLibrary = 'chakra';
    }

    // 检测 TypeScript
    techContext.typescript = !!deps['typescript'];

    // 检测状态管理
    if (deps['zustand']) {
      techContext.stateManagement = 'zustand';
    } else if (deps['@reduxjs/toolkit'] || deps['redux']) {
      techContext.stateManagement = 'redux';
    } else if (deps['jotai']) {
      techContext.stateManagement = 'jotai';
    } else if (deps['recoil']) {
      techContext.stateManagement = 'recoil';
    }

    return techContext;
  } catch (error) {
    // 如果无法读取或解析配置文件，返回空对象
    logError('detectTechStackFromConfig', error);
    return {};
  }
}

/**
 * Handle gemini_generate_ui tool call
 */
export async function handleGenerateUI(
  params: GenerateUIParams,
  client: GeminiClient
): Promise<GenerateUIResult> {
  try {
    // 验证必需参数
    validateRequired(params.description, 'description');
    validateString(params.description, 'description', 10);

    // 验证可选参数
    const framework = params.framework || 'vanilla';
    const includeAnimation = params.includeAnimation !== false; // 默认 true
    const responsive = params.responsive !== false; // 默认 true

    if (params.framework) {
      validateFramework(params.framework);
    }
    if (params.style) {
      validateUIStyle(params.style);
    }

    // 【新增】处理技术栈上下文
    let techContext: TechContext = {};
    let detectedTechContext: TechContext | undefined;

    // 如果提供了 configPath，自动检测技术栈
    if (params.configPath) {
      detectedTechContext = await detectTechStackFromConfig(params.configPath);
      techContext = { ...detectedTechContext };
    }

    // 如果提供了 techContext，覆盖自动检测的值
    if (params.techContext) {
      techContext = { ...techContext, ...params.techContext };
    }

    // 构建提示词
    let prompt = `Generate a ${framework} UI component based on the following requirements:\n\n`;
    prompt += `Description: ${params.description}\n\n`;

    if (params.style) {
      prompt += `Design Style: ${params.style}\n`;
    }

    prompt += `Framework: ${framework}\n`;
    prompt += `Include Animations: ${includeAnimation ? 'Yes' : 'No'}\n`;
    prompt += `Responsive: ${responsive ? 'Yes' : 'No'}\n`;

    // 【新增】添加技术栈上下文到提示词
    const hasTechContext = techContext.cssFramework || techContext.uiLibrary ||
                           techContext.typescript || techContext.stateManagement;
    if (hasTechContext) {
      prompt += buildTechContextPrompt(techContext);
    }

    prompt += '\n';

    if (framework === 'vanilla') {
      prompt += `Please provide a complete HTML file with inline CSS and JavaScript.\n`;
    } else {
      // 根据 TypeScript 设置调整输出要求
      if (techContext.typescript) {
        prompt += `Please provide a complete ${framework} component with TypeScript (.tsx) and all necessary imports.\n`;
      } else {
        prompt += `Please provide a complete ${framework} component with all necessary imports.\n`;
      }
    }

    prompt += `Return ONLY the code, no explanations.`;

    // 调用 Gemini API
    let code: string;

    if (params.designImage) {
      // 多模态：文本 + 图片
      code = await client.generateMultimodal(
        prompt,
        [params.designImage],
        {
          systemInstruction: UI_GENERATION_SYSTEM_PROMPT,
          temperature: 0.7,
          maxTokens: 8192
        }
      );
    } else {
      // 仅文本
      code = await client.generate(
        prompt,
        {
          systemInstruction: UI_GENERATION_SYSTEM_PROMPT,
          temperature: 0.7,
          maxTokens: 8192
        }
      );
    }

    // 清理代码输出（移除 markdown 代码块）
    code = cleanCodeOutput(code);

    // 对于 React/Vue/Svelte，可能有多个文件
    const files = framework !== 'vanilla' ? extractFiles(code, framework, techContext.typescript) : undefined;

    return {
      code,
      framework,
      files,
      preview: framework === 'vanilla' ? code : undefined,
      // 【新增】返回检测到的技术栈信息
      detectedTechContext: detectedTechContext
    };

  } catch (error: any) {
    logError('generateUI', error);
    throw handleAPIError(error);
  }
}

/**
 * Clean code output (remove markdown code blocks)
 */
function cleanCodeOutput(code: string): string {
  // Remove markdown code blocks
  code = code.replace(/```[a-z]*\n/g, '');
  code = code.replace(/```\n?/g, '');

  // Trim whitespace
  return code.trim();
}

/**
 * 从代码中提取多个文件（用于 React/Vue/Svelte）
 * @param code 生成的代码
 * @param framework 框架类型
 * @param useTypescript 是否使用 TypeScript
 */
function extractFiles(code: string, framework: string, useTypescript?: boolean): Record<string, string> | undefined {
  // 目前返回单个文件
  // 未来可以解析 Gemini 返回的多文件内容
  let extension: string;

  if (framework === 'react') {
    extension = useTypescript ? 'tsx' : 'jsx';
  } else if (framework === 'vue') {
    extension = 'vue';
  } else if (framework === 'svelte') {
    extension = 'svelte';
  } else {
    extension = useTypescript ? 'ts' : 'js';
  }

  return {
    [`Component.${extension}`]: code
  };
}
