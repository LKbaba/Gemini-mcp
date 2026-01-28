/**
 * Global constant definitions
 */

// MCP protocol version
export const MCP_VERSION = '2024-11-05';

// Server information
export const SERVER_INFO = {
  name: 'mcp-server-gemini',
  version: '1.2.4',
  description: `Gemini AI MCP Server with 5 core tools.
IMPORTANT: All tools support PARALLEL execution - call multiple tools simultaneously for better performance.
Example: analyze multiple files or search multiple queries in parallel.`,
  author: 'LKbaba',
  basedOn: 'aliargun/mcp-server-gemini v4.2.2'
};

// API configuration
export const API_CONFIG = {
  timeout: 60000, // 60 seconds
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  maxImageSize: 10 * 1024 * 1024, // 10MB
};

// Tool names - v1.2.0 streamlined to 5 core tools
export const TOOL_NAMES = {
  MULTIMODAL_QUERY: 'gemini_multimodal_query',
  ANALYZE_CONTENT: 'gemini_analyze_content',
  ANALYZE_CODEBASE: 'gemini_analyze_codebase',
  BRAINSTORM: 'gemini_brainstorm',
  SEARCH: 'gemini_search'
} as const;

// Error codes
export const ERROR_CODES = {
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  PARSE_ERROR: -32700,
  API_ERROR: -32000,
  TIMEOUT: -32001,
  RATE_LIMIT: -32002,
  MODEL_NOT_SUPPORTED: -32003
} as const;

// Default parameters
export const DEFAULT_PARAMS = {
  temperature: 0.7,
  maxTokens: 8192,
  topP: 0.95,
  topK: 40
};

// Supported frameworks
export const FRAMEWORKS = ['vanilla', 'react', 'vue', 'svelte'] as const;

// ANIMATION_TECHNOLOGIES removed - animation tool has been removed

// Supported styles
export const UI_STYLES = ['modern', 'minimal', 'glassmorphism', 'neumorphism'] as const;

// Output formats
export const OUTPUT_FORMATS = ['text', 'code', 'json', 'markdown'] as const;

// Content types
export const CONTENT_TYPES = ['code', 'document', 'data', 'auto'] as const;

// Analysis task types
export const ANALYSIS_TASKS = ['summarize', 'review', 'explain', 'optimize', 'debug'] as const;

// Codebase analysis focus areas
export const CODEBASE_FOCUS = ['architecture', 'security', 'performance', 'dependencies', 'patterns'] as const;

// Brainstorm styles
export const BRAINSTORM_STYLES = ['innovative', 'practical', 'radical'] as const;

// Feasibility levels
export const FEASIBILITY_LEVELS = ['low', 'medium', 'high'] as const;

// Severity levels
export const SEVERITY_LEVELS = ['high', 'medium', 'low'] as const;
