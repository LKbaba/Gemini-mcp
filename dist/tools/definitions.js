/**
 * MCP 工具定义
 * 符合 MCP 协议的工具 Schema
 */
import { TOOL_NAMES } from '../config/constants.js';
/**
 * 所有工具的定义
 */
export const TOOL_DEFINITIONS = [
    // 🎨 Tool 1: gemini_generate_ui
    {
        name: TOOL_NAMES.GENERATE_UI,
        description: 'Generate HTML/CSS/JavaScript UI components from description or design image. Specializes in pixel-perfect implementations, responsive layouts, and smooth animations. Supports technology stack context for generating code that matches your project.',
        inputSchema: {
            type: 'object',
            properties: {
                description: {
                    type: 'string',
                    description: 'Description of the UI component to generate'
                },
                designImage: {
                    type: 'string',
                    description: 'Optional: Design image as file path (e.g., ./images/design.png) or Base64 data URI. File paths will be automatically converted to Base64.'
                },
                framework: {
                    type: 'string',
                    enum: ['vanilla', 'react', 'vue', 'svelte'],
                    description: 'Target framework (default: vanilla)',
                    default: 'vanilla'
                },
                // 【新增】技术栈上下文
                techContext: {
                    type: 'object',
                    properties: {
                        cssFramework: {
                            type: 'string',
                            enum: ['tailwind', 'bootstrap', 'styled-components', 'css-modules', 'emotion'],
                            description: 'CSS framework to use for styling'
                        },
                        uiLibrary: {
                            type: 'string',
                            enum: ['shadcn', 'antd', 'mui', 'chakra', 'radix'],
                            description: 'UI component library to use'
                        },
                        typescript: {
                            type: 'boolean',
                            description: 'Use TypeScript with full type definitions'
                        },
                        stateManagement: {
                            type: 'string',
                            enum: ['zustand', 'redux', 'jotai', 'recoil'],
                            description: 'State management library if needed'
                        }
                    },
                    description: 'Technology stack context for generating code that matches your project'
                },
                // 【新增】配置文件路径
                configPath: {
                    type: 'string',
                    description: 'Path to package.json for auto-detecting tech stack. The tool will analyze dependencies to determine CSS framework, UI library, TypeScript usage, etc.'
                },
                includeAnimation: {
                    type: 'boolean',
                    description: 'Include animations and transitions (default: true)',
                    default: true
                },
                responsive: {
                    type: 'boolean',
                    description: 'Make the UI responsive (default: true)',
                    default: true
                },
                style: {
                    type: 'string',
                    enum: ['modern', 'minimal', 'glassmorphism', 'neumorphism'],
                    description: 'Optional: Design style preference'
                }
            },
            required: ['description']
        }
    },
    // 🖼️ Tool 2: gemini_multimodal_query
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
                }
            },
            required: ['prompt', 'images']
        }
    },
    // 🐛 Tool 3: gemini_fix_ui_from_screenshot
    {
        name: TOOL_NAMES.FIX_UI,
        description: 'Identify and fix UI issues from screenshots. Diagnoses layout problems, styling issues, responsive failures, and provides targeted code fixes. Supports reading source code files for precise diagnosis.',
        inputSchema: {
            type: 'object',
            properties: {
                screenshot: {
                    type: 'string',
                    description: 'Screenshot of the UI problem as file path (e.g., ./screenshots/bug.png) or Base64 data URI. File paths will be automatically converted to Base64.'
                },
                // 【新增】源代码文件路径
                sourceCodePath: {
                    type: 'string',
                    description: 'Path to the main source code file causing the issue (e.g., "./src/components/LoginForm.tsx"). The tool will read and analyze this file.'
                },
                // 【新增】相关文件路径列表
                relatedFiles: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Paths to related files like CSS, parent components, or utilities (e.g., ["./src/styles/login.css", "./src/components/Button.tsx"])'
                },
                // 【保留】直接传入代码内容（向后兼容）
                currentCode: {
                    type: 'string',
                    description: 'Optional: Current code causing the issue (for backward compatibility, prefer using sourceCodePath)'
                },
                issueDescription: {
                    type: 'string',
                    description: 'Optional: Description of the problem'
                },
                targetState: {
                    type: 'string',
                    description: 'Optional: Expected state description or reference image'
                }
            },
            required: ['screenshot']
        }
    },
    // ✨ Tool 4: gemini_create_animation
    {
        name: TOOL_NAMES.CREATE_ANIMATION,
        description: 'Create interactive animations using CSS, Canvas, WebGL, or Three.js. Generates production-ready animation code with smooth 60fps performance.',
        inputSchema: {
            type: 'object',
            properties: {
                description: {
                    type: 'string',
                    description: 'Description of the desired animation'
                },
                technology: {
                    type: 'string',
                    enum: ['css', 'canvas', 'webgl', 'threejs'],
                    description: 'Animation technology (default: canvas)',
                    default: 'canvas'
                },
                interactive: {
                    type: 'boolean',
                    description: 'Make it interactive (mouse/touch) (default: true)',
                    default: true
                },
                fps: {
                    type: 'number',
                    description: 'Target frames per second (default: 60)',
                    default: 60
                },
                dimensions: {
                    type: 'object',
                    properties: {
                        width: { type: 'number' },
                        height: { type: 'number' }
                    },
                    description: 'Optional: Canvas dimensions'
                }
            },
            required: ['description']
        }
    },
    // 📄 Tool 5: gemini_analyze_content
    {
        name: TOOL_NAMES.ANALYZE_CONTENT,
        description: 'Analyze code, documents, or data. Supports file path or direct content input. Provides summarization, code review, explanation, optimization, and debugging. Auto-detects content type and programming language.',
        inputSchema: {
            type: 'object',
            properties: {
                // 方式1：直接传入内容（保留，向后兼容）
                content: {
                    type: 'string',
                    description: 'Content to analyze (direct input). Use this or filePath.'
                },
                // 方式2：传入文件路径（新增）
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
                }
            },
            required: [] // 改为空数组，因为 content 和 filePath 二选一
        }
    },
    // 📦 Tool 6: gemini_analyze_codebase
    {
        name: TOOL_NAMES.ANALYZE_CODEBASE,
        description: 'Analyze entire codebase using 1M token context. Supports directory path, file paths, or file contents. Provides architecture overview, identifies patterns, security issues, performance bottlenecks, and dependency problems.',
        inputSchema: {
            type: 'object',
            properties: {
                // 方式1：目录路径（新增）
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
                // 方式2：文件路径列表（新增）
                filePaths: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of file paths to analyze (e.g., ["./src/index.ts", "./src/utils/helper.ts"]). The tool will automatically read these files.'
                },
                // 方式3：文件内容数组（保留，向后兼容）
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
                outputFormat: {
                    type: 'string',
                    enum: ['markdown', 'json'],
                    description: 'Output format (default: markdown)',
                    default: 'markdown'
                }
            },
            required: [] // 改为空数组，因为三种输入方式任选其一
        }
    },
    // 💡 Tool 7: gemini_brainstorm
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
                // 【新增】项目上下文文件路径
                contextFilePath: {
                    type: 'string',
                    description: 'Path to project context file (e.g., README.md, PRD.md). Ideas will be tailored to fit the project.'
                },
                // 【新增】多个上下文文件
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
                }
            },
            required: ['topic']
        }
    },
    // 📋 Tool 8: list_models
    {
        name: TOOL_NAMES.LIST_MODELS,
        description: 'List all available Gemini models with their capabilities, context windows, and use cases.',
        inputSchema: {
            type: 'object',
            properties: {},
            required: []
        }
    }
];
//# sourceMappingURL=definitions.js.map