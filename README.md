# Gemini MCP Server

> **Give Claude Code the power of Gemini 3.0**

An MCP server that connects Claude Code to Google's Gemini 3.0 Pro, unlocking capabilities that complement Claude's strengths.

## Why Gemini + Claude?

| Gemini's Strengths | Use Case |
|-------------------|----------|
| **1M Token Context** | Analyze entire codebases in one shot |
| **Google Search Grounding** | Get real-time documentation & latest info |
| **#1 UI Generation** | Design-to-code with pixel-perfect accuracy |
| **Multimodal Vision** | Understand screenshots, diagrams, designs |

> **Philosophy**: Claude is the commander, Gemini is the specialist.

## Quick Start

### 1. Get API Key

Visit [Google AI Studio](https://aistudio.google.com/apikey) and create an API key.

### 2. Configure Claude Code

Add to your MCP config file:

- **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "gemini": {
      "command": "npx",
      "args": ["-y", "github:LKbaba/Gemini-mcp"],
      "env": {
        "GEMINI_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### 3. Restart Claude Code

## Tools (8)

### Research & Search
| Tool | Description |
|------|-------------|
| `gemini_search` | Web search with Google Search grounding. Get real-time info, latest docs, current events. |

### Analysis (1M Token Context)
| Tool | Description |
|------|-------------|
| `gemini_analyze_codebase` | Analyze entire projects with 1M token context. Supports directory path, file paths, or direct content. |
| `gemini_analyze_content` | Analyze code, documents, or data. Supports file path or direct content input. |

### UI & Visual
| Tool | Description |
|------|-------------|
| `gemini_generate_ui` | Generate UI components from description or design image. Supports React, Vue, Svelte, vanilla. |
| `gemini_fix_ui_from_screenshot` | Visual Debug Loop - diagnose UI issues from screenshots and output git diff patches. |
| `gemini_multimodal_query` | Analyze images with natural language. Understand designs, diagrams, screenshots. |

### Creative & Utility
| Tool | Description |
|------|-------------|
| `gemini_brainstorm` | Generate creative ideas with project context. Supports reading README, PRD files. |
| `list_models` | List available Gemini models with capabilities and context windows. |

## Usage Examples

### Analyze a Large Codebase
```
"Use Gemini to analyze the ./src directory for architectural patterns and potential issues"
```

### Search for Latest Documentation
```
"Search for the latest Next.js 15 App Router documentation"
```

### Design to Code
```
"Generate a pricing card component matching this Figma screenshot" (attach image)
```

### Visual Debug Loop
```
"Fix the layout bug in this screenshot. Source file: ./src/components/Header.tsx" (attach screenshot)
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
      "args": ["-y", "github:LKbaba/Gemini-mcp"],
      "env": {
        "GEMINI_API_KEY": "your_api_key_here",
        "HTTPS_PROXY": "http://127.0.0.1:7897"
      }
    }
  }
}
```
</details>

## Supported Models

| Model | Context | Best For |
|-------|---------|----------|
| `gemini-3-pro-preview` | 1M tokens | UI generation, complex analysis (default) |
| `gemini-2.5-pro` | 1M tokens | General coding, fallback |
| `gemini-2.5-flash` | 1M tokens | Fast tasks, cost optimization |

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
│   ├── models.ts          # Model configurations
│   └── constants.ts        # Global constants
├── tools/
│   ├── definitions.ts      # MCP tool definitions
│   ├── generate-ui.ts      # UI generation
│   ├── multimodal-query.ts # Multimodal queries
│   ├── fix-ui.ts           # Visual Debug Loop
│   ├── analyze-content.ts  # Content analysis
│   ├── analyze-codebase.ts # Codebase analysis
│   ├── brainstorm.ts       # Brainstorming
│   ├── search.ts           # Web search
│   └── list-models.ts      # Model listing
├── utils/
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
