# Gemini MCP Server — Product Specification v1.4.0

## Product Information

| Field | Details |
|-------|---------|
| **Product Name** | mcp-server-gemini |
| **npm Package** | `@lkbaba/mcp-server-gemini` |
| **Current Version** | v1.4.0 |
| **Author** | LKbaba |
| **Based On** | aliargun/mcp-server-gemini v4.2.2 |
| **License** | MIT |
| **Repository** | https://github.com/LKbaba/Gemini-mcp |
| **Last Updated** | 2026-03-29 |

---

## 1. Product Overview

mcp-server-gemini is a dedicated MCP (Model Context Protocol) server that exposes Google Gemini AI capabilities to MCP clients such as Claude Code, Cursor, and Windsurf.

**Core Value**:
- Exposes Google Gemini's multimodal analysis, 1M-token context window, and Google Search grounding as MCP tools consumable by any MCP client
- Supports dual-mode authentication: AI Studio API Key (for personal development) and Vertex AI ADC (for production environments)
- 5 highly specialized tools covering image analysis, code review, codebase analysis, creative brainstorming, and real-time web search

**Runtime Model**: Standard stdio MCP server communicating with MCP clients over the JSON-RPC 2.0 protocol.

---

## 2. Tool Suite

### 2.1 Tool Overview

| Tool Name | Function | Default Model |
|-----------|----------|---------------|
| `gemini_multimodal_query` | Image + text multimodal queries | gemini-3.1-pro-preview |
| `gemini_analyze_content` | Code / document / data content analysis | gemini-3.1-pro-preview |
| `gemini_analyze_codebase` | Full codebase analysis (1M-token context) | gemini-3.1-pro-preview |
| `gemini_brainstorm` | Creative brainstorming with pros, cons, and feasibility | gemini-3.1-pro-preview |
| `gemini_search` | Real-time web search with Google Search grounding | gemini-3-flash-preview |

All tools support parallel invocation.

---

### 2.2 gemini_multimodal_query

Analyzes image content combined with natural language questions. Supports screenshots, design mockups, charts, and other visual content.

**Input Parameters**:

```typescript
{
  prompt: string,           // Required: question or instruction about the image
  images: string[],         // Required: image file paths or Base64 data URIs
  outputFormat?: 'text' | 'code' | 'json',  // Optional, default: 'text'
  context?: string,         // Optional: additional context
  model?: 'gemini-3.1-pro-preview' | 'gemini-3-pro-preview' | 'gemini-3-flash-preview'
                            // Optional, default: 'gemini-3.1-pro-preview'
}
```

**Required fields**: `prompt`, `images`

**Supported image formats**:
- File paths (automatically read and converted to Base64), e.g. `./images/screenshot.png`
- Base64 data URIs, e.g. `data:image/png;base64,...`
- HTTP/HTTPS URLs are not supported

---

### 2.3 gemini_analyze_content

Analyzes code, documents, or data. Accepts input either as a file path or as inline content. Automatically detects content type and programming language.

**Input Parameters**:

```typescript
{
  content?: string,         // Inline content (mutually exclusive with filePath)
  filePath?: string,        // File path — tool reads the file automatically (mutually exclusive with content)
                            // e.g. './src/utils/parser.ts'
  type?: 'code' | 'document' | 'data' | 'auto',  // Optional, default: 'auto'
  task?: 'summarize' | 'review' | 'explain' | 'optimize' | 'debug',
                            // Optional, default: 'summarize'
  language?: string,        // Optional: programming language (auto-detected when using filePath)
  focus?: string[],         // Optional: areas to focus on, e.g. ['security', 'performance']
  outputFormat?: 'text' | 'json' | 'markdown',  // Optional, default: 'markdown'
  model?: 'gemini-3.1-pro-preview' | 'gemini-3-pro-preview' | 'gemini-3-flash-preview'
                            // Optional, default: 'gemini-3.1-pro-preview'
}
```

**Required fields**: at least one of `content` or `filePath`

**Supports parallel invocation**: multiple files can be analyzed simultaneously.

---

### 2.4 gemini_analyze_codebase

Analyzes an entire codebase using the 1M-token context window. Provides architectural overviews, security findings, performance bottlenecks, and dependency analysis.

**Input Parameters**:

```typescript
{
  // One of three input methods (at least one required)
  directory?: string,       // Directory path — tool reads files automatically
                            // e.g. './src' or 'C:/Project/src'
  filePaths?: string[],     // List of file paths — tool reads them automatically
                            // e.g. ['./src/index.ts', './src/utils.ts']
  files?: Array<{           // Array of file objects with content (backward-compatible)
    path: string,
    content: string
  }>,

  // Used only with directory
  include?: string[],       // Glob include patterns, e.g. ['**/*.ts', '**/*.tsx']
  exclude?: string[],       // Glob exclude patterns, e.g. ['node_modules/**']

  focus?: 'architecture' | 'security' | 'performance' | 'dependencies' | 'patterns',
                            // Optional: analysis focus area
  deepThink?: boolean,      // Optional: enable deep thinking mode, default: false
  thinkingLevel?: 'low' | 'high',  // Optional: thinking depth, default: 'high'
  outputFormat?: 'markdown' | 'json',  // Optional, default: 'markdown'
  model?: 'gemini-3.1-pro-preview' | 'gemini-3-pro-preview' | 'gemini-3-flash-preview'
                            // Optional, default: 'gemini-3.1-pro-preview'
}
```

**Required fields**: at least one of `directory`, `filePaths`, or `files`

---

### 2.5 gemini_brainstorm

Generates creative ideas around a given topic. Each idea includes pros, cons, and a feasibility assessment. Supports loading project context files to produce ideas that are better tailored to the project.

**Input Parameters**:

```typescript
{
  topic: string,            // Required: brainstorming topic
  context?: string,         // Optional: additional background information
  contextFilePath?: string, // Optional: path to a project context file
                            // e.g. 'README.md' or 'PRD.md'
  contextFiles?: string[],  // Optional: paths to multiple context files
                            // e.g. ['./README.md', './docs/architecture.md']
  count?: number,           // Optional: number of ideas to generate, default: 5
  style?: 'innovative' | 'practical' | 'radical',  // Optional: thinking style
  model?: 'gemini-3.1-pro-preview' | 'gemini-3-pro-preview' | 'gemini-3-flash-preview'
                            // Optional, default: 'gemini-3.1-pro-preview'
}
```

**Required fields**: `topic`

---

### 2.6 gemini_search

Performs real-time web searches using Gemini's built-in Google Search grounding capability. Results include source citations and traceable grounding metadata.

**Input Parameters**:

```typescript
{
  query: string,            // Required: search question or query terms
  context?: string,         // Optional: additional context to guide the search
  thinkingLevel?: 'low' | 'high',  // Optional, default: 'high'
                            // low: faster response; high: deeper reasoning
  outputFormat?: 'text' | 'json',  // Optional, default: 'text'
  model?: 'gemini-3.1-pro-preview' | 'gemini-3-pro-preview' | 'gemini-3-flash-preview'
                            // Optional, default: 'gemini-3-flash-preview'
}
```

**Required fields**: `query`

**Ideal use cases**: breaking news, up-to-date documentation, live data, and fact-checking. Supports parallel invocation of multiple queries.

---

## 3. Authentication System

v1.4.0 introduces dual-mode authentication with the following detection priority: **Explicit Vertex AI config → Raw JSON auto-detect → AI Studio API Key**.

### 3.1 Mode A: AI Studio API Key

The simplest configuration, suitable for personal development and testing.

**Required environment variable**:

```
GEMINI_API_KEY=<your-api-key>
```

Obtain an API Key from [Google AI Studio](https://aistudio.google.com/).

---

### 3.2 Mode B: Vertex AI ADC

A more secure approach for production environments, authenticating via Google Application Default Credentials. Supports three configuration sub-modes:

#### Sub-mode 1: Explicit environment variables

```
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=<your-gcp-project-id>
GOOGLE_CLOUD_LOCATION=global              # Optional, default: global (required for Gemini 3.x Preview models)
GOOGLE_APPLICATION_CREDENTIALS=<path-to-sa-key.json>  # Optional if ADC is already configured
GOOGLE_CREDENTIALS_JSON=<entire-json-content>          # Optional alternative to the line above
```

`GOOGLE_CLOUD_PROJECT` is required; all other variables are optional.

#### Sub-mode 2: Inline credentials (auto-detect)

Expand the fields of a service account JSON key file directly as MCP environment variables. The system automatically recognizes this mode by detecting `type=service_account` — no need to set `GOOGLE_GENAI_USE_VERTEXAI`:

```
type=service_account
project_id=<your-project-id>
private_key_id=<key-id>
private_key=<pem-private-key>
client_email=<sa-email>
client_id=<client-id>
auth_uri=https://accounts.google.com/o/oauth2/auth
token_uri=https://oauth2.googleapis.com/token
...
```

#### Sub-mode 3: GOOGLE_CREDENTIALS_JSON

Pass the entire service account JSON file contents as a single string:

```
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=<your-gcp-project-id>
GOOGLE_CREDENTIALS_JSON={"type":"service_account","project_id":"...","private_key":"..."}
```

---

### 3.3 Windows Slash Fix

Some MCP clients on Windows corrupt `/` to `\` in environment variable values, breaking PEM private keys and URL fields. v1.4.0 includes a built-in automatic fix that safely un-escapes `private_key`, `auth_uri`, `token_uri`, and related fields — no manual intervention required.

---

### 3.4 Temporary File Credential Strategy

When service account JSON is provided via environment variables, the server writes the credentials to a file in the system temp directory (permissions `0600`) and sets `GOOGLE_APPLICATION_CREDENTIALS` to point to it. This is the most reliable way to ensure the `@google/genai` SDK authenticates correctly on Windows.

---

## 4. Model Configuration

### 4.1 Supported Models

| Model ID | Name | Context Window | Max Output | Default For | Notes |
|----------|------|----------------|-----------|-------------|-------|
| `gemini-3.1-pro-preview` | Gemini 3.1 Pro Preview | 1M tokens | 65,536 tokens | 4 primary tools | **Current default** — enhanced reasoning and agentic capabilities |
| `gemini-3-pro-preview` | Gemini 3.0 Pro Preview | 1M tokens | 65,536 tokens | — | Deprecated (retired 2026-03-09); automatically remapped to 3.1 |
| `gemini-3-flash-preview` | Gemini 3.0 Flash Preview | 1M tokens | 65,536 tokens | gemini_search | Fast responses; suited for search and simple tasks |
| `gemini-2.5-pro` | Gemini 2.5 Pro | 1M tokens | 65,536 tokens | — | Stable production model; available as an alternative |

### 4.2 Deprecated Model Auto-mapping

To maintain backward compatibility, deprecated models are automatically remapped with a warning at runtime:

```
gemini-3-pro-preview  →  gemini-3.1-pro-preview
```

### 4.3 Model Selection Guide

| Use Case | Recommended Model |
|----------|------------------|
| Complex code analysis, architecture review | `gemini-3.1-pro-preview` |
| Image analysis, multimodal tasks | `gemini-3.1-pro-preview` |
| Web search, quick Q&A | `gemini-3-flash-preview` |
| Batch processing, cost optimization | `gemini-3-flash-preview` |
| Large codebase analysis requiring stability | `gemini-2.5-pro` |

---

## 5. Configuration Examples

### 5.1 Claude Code (MCP JSON) — AI Studio Mode

```json
{
  "mcpServers": {
    "gemini": {
      "command": "npx",
      "args": ["-y", "@lkbaba/mcp-server-gemini"],
      "env": {
        "GEMINI_API_KEY": "AIza..."
      }
    }
  }
}
```

### 5.2 Claude Code (MCP JSON) — Vertex AI Explicit Config

```json
{
  "mcpServers": {
    "gemini": {
      "command": "npx",
      "args": ["-y", "@lkbaba/mcp-server-gemini"],
      "env": {
        "GOOGLE_GENAI_USE_VERTEXAI": "true",
        "GOOGLE_CLOUD_PROJECT": "my-project-123",
        "GOOGLE_CLOUD_LOCATION": "global",
        "GOOGLE_CREDENTIALS_JSON": "{\"type\":\"service_account\",\"project_id\":\"my-project-123\",\"private_key\":\"-----BEGIN RSA PRIVATE KEY-----\\n...\"}"
      }
    }
  }
}
```

### 5.3 Claude Code (MCP JSON) — Vertex AI Inline credentials

```json
{
  "mcpServers": {
    "gemini": {
      "command": "npx",
      "args": ["-y", "@lkbaba/mcp-server-gemini"],
      "env": {
        "type": "service_account",
        "project_id": "my-project-123",
        "private_key_id": "abc123",
        "private_key": "-----BEGIN RSA PRIVATE KEY-----\n...",
        "client_email": "my-sa@my-project-123.iam.gserviceaccount.com",
        "client_id": "123456789",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token"
      }
    }
  }
}
```

### 5.4 Proxy Configuration (Optional)

For network environments that require a proxy, add one of the following environment variables:

```json
{
  "env": {
    "HTTPS_PROXY": "http://127.0.0.1:7890"
  }
}
```

---

## 6. Technical Architecture

### 6.1 Tech Stack

| Component | Technology |
|-----------|-----------|
| Language | TypeScript 5.x |
| Runtime | Node.js >= 16 |
| AI SDK | @google/genai ^1.46.0 |
| File Glob | fast-glob ^3.3.3 |
| Glob Matching | micromatch ^4.0.8 |
| Proxy Support | undici ^7.16.0 |
| Module System | ESM (`"type": "module"`) |

### 6.2 Project Structure

```
src/
├── server.ts                  # Main entry point; JSON-RPC 2.0 request routing
├── types.ts                   # MCP protocol type definitions
├── config/
│   ├── constants.ts           # Tool names, API settings, error codes, and other constants
│   └── models.ts              # Model definitions, defaults, and deprecation mappings
├── tools/
│   ├── definitions.ts         # MCP schema definitions for all tools
│   ├── index.ts               # Tool handler exports
│   ├── multimodal-query.ts    # gemini_multimodal_query implementation
│   ├── analyze-content.ts     # gemini_analyze_content implementation
│   ├── analyze-codebase.ts    # gemini_analyze_codebase implementation
│   ├── brainstorm.ts          # gemini_brainstorm implementation
│   └── search.ts              # gemini_search implementation
└── utils/
    ├── gemini-client.ts       # GeminiClient wrapper (image processing, etc.)
    ├── gemini-factory.ts      # Auth detection and GoogleGenAI instance creation
    └── error-handler.ts       # Centralized error handling
```

### 6.3 Runtime Flow

1. **Server startup**: authentication mode is determined via `detectAuthConfig()`
2. **Tool invocation**: client sends a `tools/call` JSON-RPC request
3. **Lazy initialization**: the Gemini client is created on the first tool call
4. **Request routing**: `server.ts` dispatches requests to the appropriate handler based on tool name
5. **Model resolution**: `getModelConfig()` applies deprecation mappings and falls back to the default model
6. **Credential handling**: in Vertex AI mode, inline JSON credentials are written to a temp file before the SDK reads them

### 6.4 API Configuration

| Parameter | Value |
|-----------|-------|
| Timeout | 60,000 ms |
| Max Retries | 3 |
| Retry Interval | 1,000 ms |
| Max Image Size | 10 MB |
| MCP Protocol Version | 2024-11-05 |

---

## 7. Version History

| Version | Release Date | Key Changes |
|---------|-------------|-------------|
| **v1.4.0** | 2026-03 | Introduced Vertex AI dual-mode authentication; Windows slash fix; temporary file credential strategy; added `GOOGLE_CREDENTIALS_JSON` support and raw JSON auto-detection |
| v1.3.1 | 2026-03 | Bug fixes; upgraded @google/genai SDK |
| v1.3.0 | 2026-03 | Migrated to gemini-3.1-pro-preview as the default model; deprecated gemini-3-pro-preview (retired 2026-03-09); added automatic deprecated-model remapping |
| v1.2.0 | 2026-01 | Streamlined to 5 core tools (removed 4 low-usage tools); added `model` parameter to all tools; introduced `gemini_search` |
| v1.1.0 | 2026-01 | Added filesystem access capability (`filePath` parameter) |
| v1.0.1 | 2025-12 | Initial rewrite based on aliargun/mcp-server-gemini v4.2.2; 8 tools |
