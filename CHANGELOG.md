# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-04-21

> Published to npm on 2026-04-21 as `@lkbaba/mcp-server-gemini@2.0.0` (tag: `latest`).

### Changed (BREAKING — protocol layer rewrite)
- Protocol layer fully migrated to the official `@modelcontextprotocol/sdk` (`^1.29.0`)
- Hand-written JSON-RPC routing removed: no more `readline` loop, `handleRequest`, `handleInitialize`, `handleToolsList`, `handleToolsCall`, `sendResponse`, `sendError`
- `server.ts` now uses `Server` + `StdioServerTransport` + `setRequestHandler(ListToolsRequestSchema | CallToolRequestSchema)` from the SDK
- Tool errors are now mapped to SDK `McpError` with proper `ErrorCode.InvalidParams` / `InternalError` / `MethodNotFound` codes

### Fixed
- **JSON-RPC spec violation on `notifications/initialized`**: v1 responded to the notification with a JSON-RPC response object, which violates the spec (notifications must not be answered). Strict MCP clients treated the stray response as an orphaned message and dropped the connection. The SDK handles notifications correctly by design, so this class of bug is now impossible.

### Removed
- `MCPRequest`, `MCPResponse`, `NotificationMessage`, `GenerateRequest/Response`, `StreamRequest/Response`, `CancelRequest`, `ConfigureRequest`, `InitializeResult`, `ShutdownRequest`, `ExitNotification` and other v1 protocol types from `src/types.ts` (the SDK owns these now). Only `MCPError` remains — used internally by `error-handler.ts` before re-wrapping to SDK `McpError` at the handler boundary.

### Added
- `@modelcontextprotocol/sdk` `^1.29.0` as a direct dependency
- `zod` `^4.3.6` as a direct dependency (future-proofing for per-tool Zod schemas)
- Lazy Gemini client initialization in `server.ts` — auth errors surface on first `tools/call` instead of at process startup

### Migration Notes
- No user-facing behavior changes: the five tools (`gemini_search`, `gemini_multimodal_query`, `gemini_analyze_content`, `gemini_analyze_codebase`, `gemini_brainstorm`) accept the same parameters and return the same structured JSON as v1.5.1
- MCP clients that previously worked with v1 continue to work with v2 unchanged
- Clients that dropped the connection because of the notification bug (observed with certain VS Code plugins using strict MCP validators) now connect successfully

## [1.5.1] - 2026-04-21

> Published to npm on 2026-04-21 as `@lkbaba/mcp-server-gemini@1.5.1` (historical stable release for v1 users who cannot upgrade to v2).

### Fixed
- **JSON-RPC spec violation on `notifications/initialized`**: The hand-written protocol path in v1 replied to the initialized notification with an error response, which is illegal per JSON-RPC 2.0 (notifications must not be answered). Strict MCP clients (recent Claude CLI, some VS Code extensions) treated the orphan response as a server fault and dropped the connection with `MCP error -32000: Connection closed` or silently omitted the Gemini tools from the tool list.
- Fix: 14-line guard at the top of `handleRequest` that silently drops any message without an `id`. Covers `notifications/initialized` today and any future MCP notification by design.
- v2.0.0 obsoletes this hotfix by migrating the protocol layer to the official SDK, which handles notifications correctly by design.

## [1.4.0] - 2026-03-29

### Added
- Vertex AI authentication support via Application Default Credentials (ADC)
- Dual auth mode: AI Studio API Key + Vertex AI (auto-detected from environment variables)
- Three Vertex AI credential methods: explicit env vars, raw JSON paste into MCP env, `GOOGLE_CREDENTIALS_JSON` string
- `detectAuthConfig()` with 3-mode auto-detection: explicit Vertex AI → raw JSON paste → API Key
- `detectRawServiceAccountEnv()` for zero-config Vertex AI: paste service account JSON directly into MCP env field
- `fixWindowsSlashCorruption()` to fix Windows MCP clients converting `/` to `\` in env var values, corrupting PEM private keys
- `setupCredentialsTempFile()` writes credentials to temp file for reliable SDK authentication
- Auth mode logging on server startup (`[INFO] Auth mode: vertex-ai/api-key`)
- `getAI()` method on GeminiClient to expose underlying GoogleGenAI instance

### Changed
- `createGeminiAI()` now accepts `AuthConfig` object instead of raw API key string
- `handleSearch()` now receives `GoogleGenAI` instance instead of API key (consistent with other tools)
- `GeminiClient` constructor now accepts `AuthConfig` instead of `apiKey`
- `analyze-codebase` tool now uses `client.getAI()` instead of `createGeminiAI(client.getApiKey())`
- Removed `getApiKey()` from GeminiClient (not applicable in Vertex AI mode)
- Default Vertex AI location changed from `us-central1` to `global` (required for Gemini 3.x preview models)

### Fixed
- Windows env var corruption: MCP clients on Windows convert forward slashes to backslashes in env values, breaking PEM private key base64 and URL fields

### Environment Variables (Vertex AI mode)
- `GOOGLE_GENAI_USE_VERTEXAI=true` — Enable Vertex AI mode (explicit)
- `GOOGLE_CLOUD_PROJECT` — GCP project ID (required for explicit mode, auto-detected from JSON paste)
- `GOOGLE_CLOUD_LOCATION` — Region, defaults to `global` (optional)
- `GOOGLE_CREDENTIALS_JSON` — Inline service account JSON content (optional)
- `GOOGLE_APPLICATION_CREDENTIALS` — Service account JSON file path (optional)
- Or paste raw service account JSON fields directly into MCP env (auto-detected)

---

## [1.3.1] - 2026-03-23

### Fixed
- Upgraded `@google/genai` SDK 1.8.0 → 1.46.0, fixing `gemini-3.1-pro-preview` model being unusable (Bug1)
- Fixed overly broad `'model'`/`'not found'` keyword matching in error handler that misclassified file-not-found errors as MODEL_NOT_SUPPORTED (Bug1)
- Fixed `maxRetries`/`timeout` dead code that was never actually executed (Bug2, Bug6), replaced with SDK built-in retry via `httpOptions.retryOptions`
- Fixed `analyze-codebase` tool ignoring the passed-in `client` parameter and reading API key directly from `process.env` (Bug3)
- Fixed parameter validation errors being incorrectly classified as `API_ERROR (-32000)` instead of `INVALID_PARAMS (-32602)` (Bug4)
- Fixed `GeminiClient` default model still pointing to retired `gemini-3-pro-preview` instead of using `getDefaultModel()` (Bug5)
- Fixed `MCPError` not being an `Error` instance, causing missing stack traces and failed `instanceof` checks (Bug7)
- Enhanced API key sensitive information sanitization to cover URL `?key=`, Bearer tokens, and raw `AIzaSy...` keys (Bug8)

### Changed
- Unified API calling pattern across all 5 tools with new `createGeminiAI()` factory function
- Introduced `ValidationError` / `SecurityError` error classes for precise error classification in tool catch blocks
- Marked `GeminiClient` as `@deprecated`, recommending `createGeminiAI()` for new code
- All error branches now pass through original `error.message` for transparency (no more fixed error text replacing real API messages)

---

## [1.3.0] - 2026-03-09

### Changed
- **[BREAKING]** Default model updated from `gemini-3-pro-preview` to `gemini-3.1-pro-preview` due to Google's model retirement
- Updated model configuration in `src/config/models.ts` to include Gemini 3.1 Pro Preview
- Updated 4 tool files to use new default model (analyze-codebase, analyze-content, brainstorm, multimodal-query)
- Updated tool definitions enum to include new model

### Added
- Automatic model mapping for deprecated models (backward compatibility)
- Warning logs when using deprecated model names
- `DEPRECATED_MODEL_MAPPING` in models.ts for seamless migration
- Enhanced `getModelConfig()` function with auto-mapping support
- Pricing information for Gemini 3.1 Pro Preview ($1.25/M input, $5.00/M output)

### Fixed
- Corrected model list in validator error messages (removed non-existent models)
- Installed `@types/micromatch` to fix TypeScript compilation issues

### Deprecated
- `gemini-3-pro-preview` is now deprecated (retired 2026-03-09)
- Will be automatically mapped to `gemini-3.1-pro-preview`

### Migration Guide
- **No action required**: Old model names are automatically mapped
- **Recommended**: Update your code to use `gemini-3.1-pro-preview` explicitly
- **Search tool**: Continues to use `gemini-3-flash-preview` (unchanged)

### Technical Details
- Files changed: 10
- Lines of code: ~137
- Backward compatible: Yes
- Breaking changes: Only if you rely on exact model name matching

---

## [1.1.0] - 2025-11-26

### 🚀 File System Access & Tool Enhancement

This version adds direct file system access to tools, eliminating the need to pass file contents as parameters.

### Added

- **File System Access Module** (`src/utils/file-reader.ts`):
  - `readFile()` - Read single file with language detection
  - `readFiles()` - Batch read multiple files
  - `readDirectory()` - Read entire directory with glob filtering
  - Automatic binary file detection and exclusion

- **Security Module** (`src/utils/security.ts`):
  - Path traversal attack prevention using `path.relative`
  - Sensitive file protection (`.env`, `.ssh`, credentials, etc.)
  - Directory whitelist validation
  - Symlink detection
  - File size and count limits

- **New Tool Parameters**:
  - `analyze_codebase`: `directory`, `filePaths`, `include`, `exclude`
  - `analyze_content`: `filePath` with auto language detection
  - `generate_ui`: `techContext`, `configPath` for tech stack context
  - `fix_ui_from_screenshot`: `sourceCodePath`, `relatedFiles`
  - `brainstorm`: `contextFilePath`, `contextFiles` for project context

- **Structured Model Information** in `list_models`:
  - `capabilities`: Detailed capability flags (vision, function calling, etc.)
  - `useCases`: Recommended use cases in Chinese
  - `recommendations`: Model recommendations by scenario

### Changed

- **Security Improvements**:
  - Fixed directory whitelist bypass vulnerability (prefix matching issue)
  - Fixed path traversal detection to allow legitimate filenames like `vendor..lib.js`
  - Using `path.relative` for safer path validation

- All tools maintain **backward compatibility** with existing parameters

### Dependencies

- Added `micromatch` for glob pattern matching
- Added `fast-glob` for directory traversal

---

## [1.0.1] - 2025-11-26

### 🎉 Major Rewrite - LKbaba Specialized Version

This version is a complete rewrite focused on **UI generation and frontend development**, designed to complement Claude Code.

### Added

- **8 Specialized Tools**:
  - `gemini_generate_ui` - Generate UI components from description or design images
  - `gemini_multimodal_query` - Analyze images with natural language queries
  - `gemini_fix_ui_from_screenshot` - Diagnose and fix UI issues from screenshots
  - `gemini_create_animation` - Create interactive animations (CSS/Canvas/WebGL/Three.js)
  - `gemini_analyze_content` - Analyze code, documents, or data
  - `gemini_analyze_codebase` - Analyze entire codebase using 1M token context
  - `gemini_brainstorm` - Generate creative ideas with feasibility assessment
  - `list_models` - List available Gemini models

- **4 Supported Models**:
  - `gemini-3-pro-preview` (default) - Latest and most powerful for UI generation
  - `gemini-2.5-pro` - Stable fallback option
  - `gemini-2.5-flash` - Cost-effective for high-frequency tasks
  - `gemini-2.5-flash-lite` - Maximum cost savings

- **Proxy Support** - Automatic proxy configuration for users behind VPN/proxy
- **File Path Support** - Image tools now accept file paths, automatically converted to Base64
- **Modular Architecture** - Clean separation of concerns with tools, utils, and config directories

### Changed

- Complete project restructure for better maintainability
- Updated to Gemini 3.0 Pro as default model
- Simplified from 6 generic tools to 8 specialized tools
- Improved error handling and validation
- Enhanced system prompts for better output quality

### Removed

- Legacy WebSocket implementation
- Generic text generation tool (replaced with specialized tools)
- Token counting tool (not needed for this use case)
- Embedding tool (not relevant for UI generation)
- Help system (simplified documentation)

---

## Previous Versions (Original Project)

The following versions are from the original [aliargun/mcp-server-gemini](https://github.com/aliargun/mcp-server-gemini) project.

## [4.2.2] - 2025-07-08

### Fixed
- Fixed image truncation issue by adding crlfDelay: Infinity to readline interface
- Added proper UTF-8 encoding for stdin to handle large Base64 data

## [4.2.1] - 2025-07-08

### Fixed
- Fixed conversation context role validation error

## [4.2.0] - 2025-07-08

### Changed
- Cleaned up repository by removing legacy WebSocket implementation files

### Security
- Performed comprehensive security audit

## [4.1.0] - 2025-07-07

### Added
- Self-documenting `get_help` tool
- MCP resources for documentation access

## [4.0.0] - 2025-07-07

### Added
- Support for Gemini 2.5 series with thinking capabilities
- 5 powerful tools: generate_text, analyze_image, count_tokens, list_models, embed_text
- JSON mode, Google Search grounding, system instructions

### Changed
- Complete rewrite to use stdio-based MCP protocol

## [3.0.0] - 2025-07-07

### Changed
- Migrated from WebSocket to stdio-based communication

## [2.0.0] - 2025-07-07

### Changed
- Updated from deprecated @google/generative-ai to @google/genai SDK

## [1.0.0] - 2024-12-15

### Added
- Initial release with WebSocket-based MCP server
