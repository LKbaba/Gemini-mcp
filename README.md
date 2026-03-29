# Gemini MCP Server

> **Give Claude Code the power of Gemini 3.1**

An MCP server that connects Claude Code to Google's Gemini 3.1, unlocking capabilities that complement Claude's strengths.

## Why Gemini + Claude?

| Gemini's Strengths | Use Case |
|-------------------|----------|
| **1M Token Context** | Analyze entire codebases in one shot |
| **Google Search Grounding** | Get real-time documentation & latest info |
| **Multimodal Vision** | Understand screenshots, diagrams, designs |

> **Philosophy**: Claude is the commander, Gemini is the specialist.

## Quick Start

Add to your MCP config file:

- **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

Then restart Claude Code.

## Authentication

Two authentication modes are supported. The server auto-detects which mode to use based on environment variables.

### Option 1: AI Studio API Key (Simplest)

Best for personal development and quick trials.

1. Visit [Google AI Studio](https://aistudio.google.com/apikey) and create an API key
2. Add to your MCP config:

```json
{
  "mcpServers": {
    "gemini": {
      "command": "npx",
      "args": ["-y", "@lkbaba/mcp-server-gemini"],
      "env": {
        "GEMINI_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Option 2: Vertex AI (Recommended for Production)

More secure, uses Google Cloud IAM authentication.

**Prerequisites:**
1. A Google Cloud project with Vertex AI API enabled
2. A service account with **Vertex AI User** role ([create one here](https://console.cloud.google.com/iam-admin/serviceaccounts))

**Setup (2 minutes):**
1. Create a service account in GCP Console → download JSON key file
2. Open the JSON key file, copy **all** key-value pairs
3. Paste them into the `env` section of your MCP config:

```json
{
  "mcpServers": {
    "gemini": {
      "command": "npx",
      "args": ["-y", "@lkbaba/mcp-server-gemini"],
      "env": {
        "type": "service_account",
        "project_id": "your-project-id",
        "private_key_id": "key-id-here",
        "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n",
        "client_email": "your-sa@your-project.iam.gserviceaccount.com",
        "client_id": "123456789",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/your-sa%40your-project.iam.gserviceaccount.com",
        "universe_domain": "googleapis.com"
      }
    }
  }
}
```

The server **auto-detects** service account credentials from env vars — no `GOOGLE_GENAI_USE_VERTEXAI` or `GOOGLE_CLOUD_PROJECT` needed. Just paste and go.

> **Tip:** On Windows, the server automatically fixes slash corruption (`/` → `\`) in PEM private keys that some MCP clients introduce.

> **Advanced options:** You can also use `GOOGLE_GENAI_USE_VERTEXAI=true` + `GOOGLE_CREDENTIALS_JSON`, `GOOGLE_APPLICATION_CREDENTIALS` (file path), or `gcloud auth application-default login`. See the environment variables reference below.

<details>
<summary>Environment variables reference</summary>

**Paste JSON approach** (Option 2 above — simplest for Vertex AI):

Just paste the service account JSON fields directly into `env`. No extra variables needed — the server auto-detects `type: "service_account"`.

**Explicit Vertex AI mode** (advanced):

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_GENAI_USE_VERTEXAI` | Yes | Set to `"true"` to enable |
| `GOOGLE_CLOUD_PROJECT` | Yes | GCP project ID |
| `GOOGLE_CLOUD_LOCATION` | No | Region (default: `global`) |
| `GOOGLE_CREDENTIALS_JSON` | No* | Entire service account JSON as a single string |
| `GOOGLE_APPLICATION_CREDENTIALS` | No* | File path to service account JSON key |

\* At least one credential source is needed: `GOOGLE_CREDENTIALS_JSON`, `GOOGLE_APPLICATION_CREDENTIALS`, or `gcloud` ADC.

**AI Studio mode:**

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | API key from [Google AI Studio](https://aistudio.google.com/apikey) |

If both modes are configured, Vertex AI takes priority.
</details>

### Migration Notice (v1.3.0+)

- The default model is now `gemini-3.1-pro-preview`
- Old model names are automatically mapped (no config changes needed)
- See [CHANGELOG.md](CHANGELOG.md) for details

## Tools (5)

### Research & Search
| Tool | Description |
|------|-------------|
| `gemini_search` | Web search with Google Search grounding. Get real-time info, latest docs, current events. |

### Analysis (1M Token Context)
| Tool | Description |
|------|-------------|
| `gemini_analyze_codebase` | Analyze entire projects with 1M token context. Supports directory path, file paths, or direct content. |
| `gemini_analyze_content` | Analyze code, documents, or data. Supports file path or direct content input. |

### Multimodal
| Tool | Description |
|------|-------------|
| `gemini_multimodal_query` | Analyze images with natural language. Understand designs, diagrams, screenshots. |

### Creative
| Tool | Description |
|------|-------------|
| `gemini_brainstorm` | Generate creative ideas with project context. Supports reading README, PRD files. |

## Model Selection (v1.3.0)

All tools now support an optional `model` parameter:

| Model | Speed | Best For |
|-------|-------|----------|
| `gemini-3.1-pro-preview` | Standard | Complex analysis, deep reasoning, agentic workflows (default) |
| `gemini-3-flash-preview` | Fast | Simple tasks, quick responses, search queries |

**Note**: `gemini-3-pro-preview` is deprecated (retired 2026-03-09) and will be automatically mapped to `gemini-3.1-pro-preview`.

**Example: Use the new default model**
```json
{
  "name": "gemini_analyze_content",
  "arguments": {
    "filePath": "./src/index.ts",
    "task": "review",
    "model": "gemini-3.1-pro-preview"
  }
}
```

## Usage Examples

### Analyze a Large Codebase
```
"Use Gemini to analyze the ./src directory for architectural patterns and potential issues"
```

### Search for Latest Documentation
```
"Search for the latest Next.js 15 App Router documentation"
```

### Analyze an Image
```
"Analyze this architecture diagram and explain the data flow" (attach image)
```

### Brainstorm with Context
```
"Brainstorm feature ideas based on this project's README.md"
```

## Proxy Configuration

<details>
<summary>For users behind proxy/VPN</summary>

Add proxy environment variable to your config:

```json
{
  "mcpServers": {
    "gemini": {
      "command": "npx",
      "args": ["-y", "@lkbaba/mcp-server-gemini"],
      "env": {
        "GEMINI_API_KEY": "your_api_key_here",
        "HTTPS_PROXY": "http://127.0.0.1:7897"
      }
    }
  }
}
```
</details>

## Local Development

<details>
<summary>Build from source</summary>

```bash
git clone https://github.com/LKbaba/Gemini-mcp.git
cd Gemini-mcp
npm install
npm run build
export GEMINI_API_KEY="your_api_key_here"
npm start
```
</details>

## Project Structure

```
src/
├── config/
│   ├── models.ts           # Model configurations
│   └── constants.ts        # Global constants
├── tools/
│   ├── definitions.ts      # MCP tool definitions
│   ├── multimodal-query.ts # Multimodal queries
│   ├── analyze-content.ts  # Content analysis
│   ├── analyze-codebase.ts # Codebase analysis
│   ├── brainstorm.ts       # Brainstorming
│   └── search.ts           # Web search
├── utils/
│   ├── gemini-factory.ts   # Dual-mode auth factory (API Key + Vertex AI)
│   ├── gemini-client.ts    # Gemini API client
│   ├── file-reader.ts      # File system access
│   ├── security.ts         # Path validation
│   ├── validators.ts       # Parameter validation
│   └── error-handler.ts    # Error handling
├── types.ts                # Type definitions
└── server.ts               # Main server
```

## Credits

Based on [aliargun/mcp-server-gemini](https://github.com/aliargun/mcp-server-gemini)

## License

MIT
