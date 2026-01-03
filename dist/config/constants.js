/**
 * Global constant definitions
 */
// MCP protocol version
export const MCP_VERSION = '2024-11-05';
// Server information
export const SERVER_INFO = {
    name: 'mcp-server-gemini',
    version: '1.1.0',
    description: 'Specialized MCP server for Gemini 3.0 Pro focused on UI generation and frontend development',
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
// Tool names
export const TOOL_NAMES = {
    GENERATE_UI: 'gemini_generate_ui',
    MULTIMODAL_QUERY: 'gemini_multimodal_query',
    FIX_UI: 'gemini_fix_ui_from_screenshot',
    // CREATE_ANIMATION removed - animation can be generated via generate_ui
    ANALYZE_CONTENT: 'gemini_analyze_content',
    ANALYZE_CODEBASE: 'gemini_analyze_codebase',
    BRAINSTORM: 'gemini_brainstorm',
    SEARCH: 'gemini_search',
    LIST_MODELS: 'list_models'
};
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
};
// Default parameters
export const DEFAULT_PARAMS = {
    temperature: 0.7,
    maxTokens: 8192,
    topP: 0.95,
    topK: 40
};
// Supported frameworks
export const FRAMEWORKS = ['vanilla', 'react', 'vue', 'svelte'];
// ANIMATION_TECHNOLOGIES removed - animation tool has been removed
// Supported styles
export const UI_STYLES = ['modern', 'minimal', 'glassmorphism', 'neumorphism'];
// Output formats
export const OUTPUT_FORMATS = ['text', 'code', 'json', 'markdown'];
// Content types
export const CONTENT_TYPES = ['code', 'document', 'data', 'auto'];
// Analysis task types
export const ANALYSIS_TASKS = ['summarize', 'review', 'explain', 'optimize', 'debug'];
// Codebase analysis focus areas
export const CODEBASE_FOCUS = ['architecture', 'security', 'performance', 'dependencies', 'patterns'];
// Brainstorm styles
export const BRAINSTORM_STYLES = ['innovative', 'practical', 'radical'];
// Feasibility levels
export const FEASIBILITY_LEVELS = ['low', 'medium', 'high'];
// Severity levels
export const SEVERITY_LEVELS = ['high', 'medium', 'low'];
//# sourceMappingURL=constants.js.map