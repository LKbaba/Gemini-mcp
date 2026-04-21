## Project Overview
- **Name**: mcp-server-gemini (npm: @lkbaba/mcp-server-gemini)
- **Version**: 2.0.0
- **Purpose**: MCP server providing 5 Gemini AI tools for Claude Code and other MCP clients
- **Author**: LKbaba (based on aliargun/mcp-server-gemini v4.2.2)

## Architecture
- **Protocol layer**: `@modelcontextprotocol/sdk` v1.29+ (v2.0 migration; v1.x used hand-written JSON-RPC)
- **Auth**: Dual mode — AI Studio API Key (`GEMINI_API_KEY`) or Vertex AI ADC (service account / gcloud)
- **Auth detection**: `gemini-factory.ts:detectAuthConfig()` with 3-mode priority: explicit Vertex AI → raw JSON paste → API Key
- **Default Vertex AI location**: `global` (required for Gemini 3.x preview models)
- **5 Tools**: multimodal_query, analyze_content, analyze_codebase, brainstorm, search
- **Models**: gemini-3.1-pro-preview (default), gemini-3-flash-preview (search default)
- **Build**: TypeScript → dist/, run with `node dist/server.js`

## Key Implementation Details
- `server.ts` uses `Server` + `StdioServerTransport` + `setRequestHandler(ListToolsRequestSchema | CallToolRequestSchema)`; notifications are handled silently by the SDK (fixes the v1 `notifications/initialized` spec violation that caused `Connection closed` in strict MCP clients)
- Gemini clients are lazy-initialized on first `tools/call` — auth errors surface at call time, not at startup
- Tool errors are mapped to SDK `McpError` with `ErrorCode.InvalidParams` / `InternalError` / `MethodNotFound`
- Windows MCP clients corrupt `/` → `\` in env vars; `fixWindowsSlashCorruption()` in gemini-factory.ts handles this
- Service account credentials written to temp file via `setupCredentialsTempFile()` to avoid PEM encoding issues
- `GeminiClient` wraps GoogleGenAI for 4 tools; `search.ts` receives raw GoogleGenAI instance directly
- Tool input schemas in `tools/definitions.ts` are still hand-written JSON Schema (SDK accepts both; Zod migration deferred)

## Development Environment
- OS: Windows 10.0.19045
- Shell: Git Bash
- Path format: Windows (use forward slashes in Git Bash)
- File system: Case-insensitive
- Line endings: CRLF (configure Git autocrlf)

## Build & Test
- Build: `npx tsc`
- Test MCP locally: configure in Claude Code MCP settings with `node` command pointing to `dist/server.js`
- Publish: `npm publish --access public`

## Playwright MCP Guide

File paths:
- Screenshots: `./CCimages/screenshots/`
- PDFs: `./CCimages/pdfs/`

Browser version fix:
- Error: "Executable doesn't exist at chromium-1179" → Version mismatch
- Quick fix: `cd ~/AppData/Local/ms-playwright && cmd //c "mklink /J chromium-1179 chromium-1181"`
- Or install: `npx playwright@1.40.0 install chromium`

## Codex MCP Guide

Codex is an autonomous coding agent by OpenAI, integrated via MCP.

Workflow: Claude plans architecture → delegate scoped tasks to Codex → review results
- `codex` tool: start a session with prompt, sandbox, approval-policy
- `codex-reply` tool: continue a session by threadId for multi-turn tasks
- Pass project context via `developer-instructions` parameter
- Recommended: sandbox='workspace-write', approval-policy='on-failure'

Prerequisite: `npm i -g @openai/codex`, OPENAI_API_KEY configured
