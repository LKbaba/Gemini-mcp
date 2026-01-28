/**
 * MCP 工具定义
 * 符合 MCP 协议的工具 schema
 *
 * v1.2.0 更新：
 * - 精简为 5 个核心工具
 * - 所有工具新增 model 参数
 */
import { TOOL_NAMES } from '../config/constants.js';
// 模型参数定义（大多数工具共享，默认 Pro）
const MODEL_PARAMETER = {
    type: 'string',
    enum: ['gemini-3-pro-preview', 'gemini-3-flash-preview'],
    description: 'Gemini model to use (optional, default: gemini-3-pro-preview)'
};
// Search 工具专用模型参数（默认 Flash，因为搜索场景 Flash 更快且质量相当）
const SEARCH_MODEL_PARAMETER = {
    type: 'string',
    enum: ['gemini-3-pro-preview', 'gemini-3-flash-preview'],
    description: 'Gemini model to use (optional, default: gemini-3-flash-preview for faster search)'
};
/**
 * 所有工具的定义
 */
export const TOOL_DEFINITIONS = [
    // 🖼️ 工具 1: gemini_multimodal_query
    {
        name: TOOL_NAMES.MULTIMODAL_QUERY,
        description: 'Query using images + text for multimodal understanding. Analyze designs, diagrams, screenshots, or any visual content with natural language questions.',
        inputSchema: {
            type: 'object',
            properties: {
                prompt: {
                    type: 'string',
                    description: 'Question or instruction about the images'
                },
                images: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Images as file paths (e.g., ./images/screenshot.png) or Base64 data URIs. File paths will be automatically converted to Base64.'
                },
                outputFormat: {
                    type: 'string',
                    enum: ['text', 'code', 'json'],
                    description: 'Desired output format (default: text)',
                    default: 'text'
                },
                context: {
                    type: 'string',
                    description: 'Optional: Additional context for better understanding'
                },
                model: MODEL_PARAMETER
            },
            required: ['prompt', 'images']
        }
    },
    // 📄 工具 2: gemini_analyze_content
    {
        name: TOOL_NAMES.ANALYZE_CONTENT,
        description: `Analyze code, documents, or data. Supports file path or direct content input. Provides summarization, code review, explanation, optimization, and debugging. Auto-detects content type and programming language.

TIP: This tool supports PARALLEL calls - analyze multiple files simultaneously for faster results.`,
        inputSchema: {
            type: 'object',
            properties: {
                // 方式 1: 直接输入内容（保持向后兼容）
                content: {
                    type: 'string',
                    description: 'Content to analyze (direct input). Use this or filePath.'
                },
                // 方式 2: 文件路径输入
                filePath: {
                    type: 'string',
                    description: 'File path to read and analyze (e.g., "./src/utils/parser.ts"). The tool will automatically read the file and detect the language. Use this or content.'
                },
                type: {
                    type: 'string',
                    enum: ['code', 'document', 'data', 'auto'],
                    description: 'Content type (default: auto)',
                    default: 'auto'
                },
                task: {
                    type: 'string',
                    enum: ['summarize', 'review', 'explain', 'optimize', 'debug'],
                    description: 'Analysis task (default: summarize)',
                    default: 'summarize'
                },
                language: {
                    type: 'string',
                    description: 'Optional: Programming language (if code). Auto-detected when using filePath.'
                },
                focus: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Optional: Specific areas to focus on (e.g., ["security", "performance"])'
                },
                outputFormat: {
                    type: 'string',
                    enum: ['text', 'json', 'markdown'],
                    description: 'Output format (default: markdown)',
                    default: 'markdown'
                },
                model: MODEL_PARAMETER
            },
            required: [] // content 或 filePath 二选一
        }
    },
    // 📦 工具 3: gemini_analyze_codebase
    {
        name: TOOL_NAMES.ANALYZE_CODEBASE,
        description: 'Analyze entire codebase using 1M token context. Supports directory path, file paths, or file contents. Provides architecture overview, identifies patterns, security issues, performance bottlenecks, and dependency problems.',
        inputSchema: {
            type: 'object',
            properties: {
                // 方式 1: 目录路径
                directory: {
                    type: 'string',
                    description: 'Directory path to analyze (e.g., "./src" or "C:/Project/src"). The tool will automatically read files from this directory.'
                },
                include: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Glob patterns to include files (e.g., ["**/*.ts", "**/*.tsx"]). Only used with directory parameter.'
                },
                exclude: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Glob patterns to exclude files (e.g., ["node_modules/**", "**/*.test.ts"]). Only used with directory parameter.'
                },
                // 方式 2: 文件路径列表
                filePaths: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of file paths to analyze (e.g., ["./src/index.ts", "./src/utils/helper.ts"]). The tool will automatically read these files.'
                },
                // 方式 3: 文件内容数组（保持向后兼容）
                files: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            path: { type: 'string' },
                            content: { type: 'string' }
                        },
                        required: ['path', 'content']
                    },
                    description: 'List of files with their content (for backward compatibility). Use directory or filePaths for easier usage.'
                },
                focus: {
                    type: 'string',
                    enum: ['architecture', 'security', 'performance', 'dependencies', 'patterns'],
                    description: 'Optional: Analysis focus area'
                },
                deepThink: {
                    type: 'boolean',
                    description: 'Enable Deep Think mode for complex analysis (default: false)',
                    default: false
                },
                thinkingLevel: {
                    type: 'string',
                    enum: ['low', 'high'],
                    description: 'Thinking depth: low for speed, high for complex analysis (default: high)',
                    default: 'high'
                },
                outputFormat: {
                    type: 'string',
                    enum: ['markdown', 'json'],
                    description: 'Output format (default: markdown)',
                    default: 'markdown'
                },
                model: MODEL_PARAMETER
            },
            required: [] // 三种输入方式任选其一
        }
    },
    // 💡 工具 4: gemini_brainstorm
    {
        name: TOOL_NAMES.BRAINSTORM,
        description: 'Generate creative ideas and solutions. Provides multiple ideas with pros/cons and feasibility assessment. Supports reading project context files to generate ideas that fit your project.',
        inputSchema: {
            type: 'object',
            properties: {
                topic: {
                    type: 'string',
                    description: 'Topic for brainstorming'
                },
                context: {
                    type: 'string',
                    description: 'Optional: Additional context'
                },
                // 项目上下文文件路径
                contextFilePath: {
                    type: 'string',
                    description: 'Path to project context file (e.g., README.md, PRD.md). Ideas will be tailored to fit the project.'
                },
                // 多个上下文文件
                contextFiles: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Paths to multiple context files (e.g., ["./README.md", "./docs/architecture.md"])'
                },
                count: {
                    type: 'number',
                    description: 'Number of ideas to generate (default: 5)',
                    default: 5
                },
                style: {
                    type: 'string',
                    enum: ['innovative', 'practical', 'radical'],
                    description: 'Optional: Brainstorming style'
                },
                model: MODEL_PARAMETER
            },
            required: ['topic']
        }
    },
    // 🔍 工具 5: gemini_search
    {
        name: TOOL_NAMES.SEARCH,
        description: `Search the web using Gemini's built-in Google Search grounding.

Features:
- Returns up-to-date information with source citations
- Supports thinkingLevel for reasoning depth control
- Ideal for: current events, latest documentation, real-time data, fact-checking

Usage Tips:
- Use thinkingLevel: 'low' for simple queries (faster response)
- Use thinkingLevel: 'high' for complex analysis (deeper reasoning)
- Use outputFormat: 'json' when you need structured data
- Search results include source URLs in groundingMetadata
- PARALLEL CALLS SUPPORTED: Search multiple queries simultaneously for faster results`,
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search query or question to answer using web search'
                },
                context: {
                    type: 'string',
                    description: 'Optional: Additional context to help refine the search'
                },
                thinkingLevel: {
                    type: 'string',
                    enum: ['low', 'high'],
                    description: 'Thinking depth: low for speed, high for complex analysis (default: high)',
                    default: 'high'
                },
                outputFormat: {
                    type: 'string',
                    enum: ['text', 'json'],
                    description: 'Output format: text for readable response, json for structured data (default: text)',
                    default: 'text'
                },
                model: SEARCH_MODEL_PARAMETER
            },
            required: ['query']
        }
    }
];
//# sourceMappingURL=definitions.js.map