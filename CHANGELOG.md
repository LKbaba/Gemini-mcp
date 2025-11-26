# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
