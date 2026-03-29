# Gemini MCP Server — 产品规格说明书 v1.4.0

## 产品信息

| 字段 | 内容 |
|------|------|
| **产品名称** | mcp-server-gemini |
| **npm 包名** | `@lkbaba/mcp-server-gemini` |
| **当前版本** | v1.4.0 |
| **作者** | LKbaba |
| **基于** | aliargun/mcp-server-gemini v4.2.2 |
| **协议** | MIT |
| **仓库** | https://github.com/LKbaba/Gemini-mcp |
| **最后更新** | 2026-03-29 |

---

## 1. 产品概述

mcp-server-gemini 是一个专用 MCP（Model Context Protocol）服务器，为 Claude Code、Cursor、Windsurf 等 MCP 客户端提供 Gemini AI 能力。

**核心价值**：
- 将 Google Gemini 的多模态分析、100 万 token 上下文、Google 搜索接地等能力以 MCP 工具形式暴露给任意 MCP 客户端
- 支持 AI Studio API Key（个人开发）与 Vertex AI ADC（生产环境）双模式认证
- 5 个高度专业化的工具，覆盖图像分析、代码审查、代码库分析、创意头脑风暴和实时网络搜索

**运行方式**：标准 stdio MCP 服务器，通过 JSON-RPC 2.0 协议与 MCP 客户端通信。

---

## 2. 工具集

### 2.1 工具总览

| 工具名 | 功能 | 默认模型 |
|--------|------|---------|
| `gemini_multimodal_query` | 图片 + 文本多模态查询 | gemini-3.1-pro-preview |
| `gemini_analyze_content` | 代码/文档/数据内容分析 | gemini-3.1-pro-preview |
| `gemini_analyze_codebase` | 整个代码库分析（100 万 token 上下文） | gemini-3.1-pro-preview |
| `gemini_brainstorm` | 创意头脑风暴，含优缺点与可行性评估 | gemini-3.1-pro-preview |
| `gemini_search` | Google 搜索接地的实时网络搜索 | gemini-3-flash-preview |

所有工具均支持并行调用。

---

### 2.2 gemini_multimodal_query

分析图片内容，结合自然语言提问。支持截图、设计稿、图表等视觉内容。

**输入参数**：

```typescript
{
  prompt: string,           // 必填：关于图片的问题或指令
  images: string[],         // 必填：图片文件路径或 Base64 数据 URI
  outputFormat?: 'text' | 'code' | 'json',  // 可选，默认: 'text'
  context?: string,         // 可选：额外上下文信息
  model?: 'gemini-3.1-pro-preview' | 'gemini-3-pro-preview' | 'gemini-3-flash-preview'
                            // 可选，默认: 'gemini-3.1-pro-preview'
}
```

**必填字段**：`prompt`、`images`

**图片格式支持**：
- 文件路径（自动读取并转换为 Base64），例如 `./images/screenshot.png`
- Base64 数据 URI，例如 `data:image/png;base64,...`
- 不支持 HTTP/HTTPS URL

---

### 2.3 gemini_analyze_content

分析代码、文档或数据。支持通过文件路径或直接传入内容两种方式。自动检测内容类型和编程语言。

**输入参数**：

```typescript
{
  content?: string,         // 直接内容输入（与 filePath 二选一）
  filePath?: string,        // 文件路径，工具自动读取（与 content 二选一）
                            // 例如: './src/utils/parser.ts'
  type?: 'code' | 'document' | 'data' | 'auto',  // 可选，默认: 'auto'
  task?: 'summarize' | 'review' | 'explain' | 'optimize' | 'debug',
                            // 可选，默认: 'summarize'
  language?: string,        // 可选：编程语言（使用 filePath 时自动检测）
  focus?: string[],         // 可选：关注点，例如 ['security', 'performance']
  outputFormat?: 'text' | 'json' | 'markdown',  // 可选，默认: 'markdown'
  model?: 'gemini-3.1-pro-preview' | 'gemini-3-pro-preview' | 'gemini-3-flash-preview'
                            // 可选，默认: 'gemini-3.1-pro-preview'
}
```

**必填字段**：`content` 或 `filePath` 至少一个

**支持并行调用**：可同时分析多个文件。

---

### 2.4 gemini_analyze_codebase

利用 100 万 token 上下文窗口分析整个代码库。提供架构概览、安全问题、性能瓶颈和依赖关系分析。

**输入参数**：

```typescript
{
  // 三种输入方式之一（至少提供一种）
  directory?: string,       // 目录路径，工具自动读取文件
                            // 例如: './src' 或 'C:/Project/src'
  filePaths?: string[],     // 文件路径列表，工具自动读取
                            // 例如: ['./src/index.ts', './src/utils.ts']
  files?: Array<{           // 文件内容数组（向后兼容）
    path: string,
    content: string
  }>,

  // 仅与 directory 配合使用
  include?: string[],       // Glob 包含模式，例如 ['**/*.ts', '**/*.tsx']
  exclude?: string[],       // Glob 排除模式，例如 ['node_modules/**']

  focus?: 'architecture' | 'security' | 'performance' | 'dependencies' | 'patterns',
                            // 可选：分析聚焦方向
  deepThink?: boolean,      // 可选：启用深度思考模式，默认: false
  thinkingLevel?: 'low' | 'high',  // 可选：思考深度，默认: 'high'
  outputFormat?: 'markdown' | 'json',  // 可选，默认: 'markdown'
  model?: 'gemini-3.1-pro-preview' | 'gemini-3-pro-preview' | 'gemini-3-flash-preview'
                            // 可选，默认: 'gemini-3.1-pro-preview'
}
```

**必填字段**：`directory`、`filePaths`、`files` 三者提供其一

---

### 2.5 gemini_brainstorm

围绕指定主题生成创意方案，每个方案包含优缺点和可行性评估。支持读取项目上下文文件生成更贴合项目的想法。

**输入参数**：

```typescript
{
  topic: string,            // 必填：头脑风暴主题
  context?: string,         // 可选：额外背景信息
  contextFilePath?: string, // 可选：项目上下文文件路径
                            // 例如: 'README.md'、'PRD.md'
  contextFiles?: string[],  // 可选：多个上下文文件路径
                            // 例如: ['./README.md', './docs/architecture.md']
  count?: number,           // 可选：生成想法数量，默认: 5
  style?: 'innovative' | 'practical' | 'radical',  // 可选：思维风格
  model?: 'gemini-3.1-pro-preview' | 'gemini-3-pro-preview' | 'gemini-3-flash-preview'
                            // 可选，默认: 'gemini-3.1-pro-preview'
}
```

**必填字段**：`topic`

---

### 2.6 gemini_search

使用 Gemini 内置 Google 搜索接地能力进行实时网络搜索。结果包含来源引用和可追溯的 grounding 元数据。

**输入参数**：

```typescript
{
  query: string,            // 必填：搜索问题或查询词
  context?: string,         // 可选：辅助搜索的额外上下文
  thinkingLevel?: 'low' | 'high',  // 可选，默认: 'high'
                            // low: 快速响应；high: 深度推理
  outputFormat?: 'text' | 'json',  // 可选，默认: 'text'
  model?: 'gemini-3.1-pro-preview' | 'gemini-3-pro-preview' | 'gemini-3-flash-preview'
                            // 可选，默认: 'gemini-3-flash-preview'
}
```

**必填字段**：`query`

**适用场景**：最新资讯、最新文档、实时数据、事实核查。支持并行调用多个查询。

---

## 3. 认证体系

v1.4.0 引入双模式认证，检测优先级为：**Vertex AI 显式配置 → 原始 JSON 自动检测 → AI Studio API Key**。

### 3.1 模式 A：AI Studio API Key

最简配置，适合个人开发和测试。

**所需环境变量**：

```
GEMINI_API_KEY=<your-api-key>
```

从 [Google AI Studio](https://aistudio.google.com/) 获取 API Key。

---

### 3.2 模式 B：Vertex AI ADC

更安全的生产方式，通过 Google Application Default Credentials 认证。支持三种配置子方式：

#### 子方式 1：显式环境变量

```
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=<your-gcp-project-id>
GOOGLE_CLOUD_LOCATION=global              # 可选，默认: global（Gemini 3.x Preview 模型必须）
GOOGLE_APPLICATION_CREDENTIALS=<path-to-sa-key.json>  # 可选，已有 ADC 时不需要
GOOGLE_CREDENTIALS_JSON=<entire-json-content>          # 可选，替代上一行
```

`GOOGLE_CLOUD_PROJECT` 为必填，其余可选。

#### 子方式 2：原始 JSON 字段直接粘贴（自动检测）

将服务账号 JSON 密钥文件的各字段直接展开为 MCP 环境变量。系统通过检测 `type=service_account` 自动识别此模式，无需设置 `GOOGLE_GENAI_USE_VERTEXAI`：

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

#### 子方式 3：GOOGLE_CREDENTIALS_JSON

将整个服务账号 JSON 文件内容作为单一字符串传入：

```
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=<your-gcp-project-id>
GOOGLE_CREDENTIALS_JSON={"type":"service_account","project_id":"...","private_key":"..."}
```

---

### 3.3 Windows 斜杠修复

MCP 客户端在 Windows 上可能将环境变量值中的 `/` 转换为 `\`，导致 PEM 私钥和 URL 字段损坏。v1.4.0 内置自动修复逻辑，对 `private_key`、`auth_uri`、`token_uri` 等字段进行安全反转义，无需手动干预。

---

### 3.4 临时文件凭证方案

当通过环境变量传入服务账号 JSON 时，服务器会将凭证写入系统临时目录（权限 `0600`），并设置 `GOOGLE_APPLICATION_CREDENTIALS` 指向该文件。这是确保 @google/genai SDK 在 Windows 环境下可靠认证的最稳妥方式。

---

## 4. 模型配置

### 4.1 支持的模型

| 模型 ID | 名称 | 上下文窗口 | 输出上限 | 默认工具 | 说明 |
|---------|------|-----------|---------|---------|------|
| `gemini-3.1-pro-preview` | Gemini 3.1 Pro Preview | 100 万 token | 65,536 token | 4 个主力工具 | **当前默认**，增强推理与 Agentic 能力 |
| `gemini-3-pro-preview` | Gemini 3.0 Pro Preview | 100 万 token | 65,536 token | — | 已废弃（2026-03-09 退役），自动映射到 3.1 |
| `gemini-3-flash-preview` | Gemini 3.0 Flash Preview | 100 万 token | 65,536 token | gemini_search | 快速响应，适合搜索和简单任务 |
| `gemini-2.5-pro` | Gemini 2.5 Pro | 100 万 token | 65,536 token | — | 稳定生产模型，可选备用 |

### 4.2 废弃模型自动映射

为保持向后兼容，使用已废弃模型时系统自动映射并输出警告：

```
gemini-3-pro-preview  →  gemini-3.1-pro-preview
```

### 4.3 模型选择建议

| 场景 | 推荐模型 |
|------|---------|
| 复杂代码分析、架构审查 | `gemini-3.1-pro-preview` |
| 图像分析、多模态任务 | `gemini-3.1-pro-preview` |
| 网络搜索、快速问答 | `gemini-3-flash-preview` |
| 批量处理、成本优化 | `gemini-3-flash-preview` |
| 大型代码库稳定分析 | `gemini-2.5-pro` |

---

## 5. 配置示例

### 5.1 Claude Code（MCP JSON）— AI Studio 模式

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

### 5.2 Claude Code（MCP JSON）— Vertex AI 显式配置

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

### 5.3 Claude Code（MCP JSON）— Vertex AI 原始 JSON 展开

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

### 5.4 代理配置（可选）

在需要代理的网络环境中，添加以下任意环境变量：

```json
{
  "env": {
    "HTTPS_PROXY": "http://127.0.0.1:7890"
  }
}
```

---

## 6. 技术架构

### 6.1 技术栈

| 组件 | 技术 |
|------|------|
| 语言 | TypeScript 5.x |
| 运行时 | Node.js >= 16 |
| AI SDK | @google/genai ^1.46.0 |
| 文件 Glob | fast-glob ^3.3.3 |
| Glob 匹配 | micromatch ^4.0.8 |
| 代理支持 | undici ^7.16.0 |
| 模块系统 | ESM（`"type": "module"`） |

### 6.2 项目结构

```
src/
├── server.ts                  # 主入口，JSON-RPC 2.0 请求路由
├── types.ts                   # MCP 协议类型定义
├── config/
│   ├── constants.ts           # 工具名、API 配置、错误码等常量
│   └── models.ts              # 模型定义、默认模型、废弃映射
├── tools/
│   ├── definitions.ts         # 所有工具的 MCP schema 定义
│   ├── index.ts               # 工具处理器导出
│   ├── multimodal-query.ts    # gemini_multimodal_query 实现
│   ├── analyze-content.ts     # gemini_analyze_content 实现
│   ├── analyze-codebase.ts    # gemini_analyze_codebase 实现
│   ├── brainstorm.ts          # gemini_brainstorm 实现
│   └── search.ts              # gemini_search 实现
└── utils/
    ├── gemini-client.ts       # GeminiClient 封装（图像处理等）
    ├── gemini-factory.ts      # 认证检测、GoogleGenAI 实例创建
    └── error-handler.ts       # 统一错误处理
```

### 6.3 关键运行流程

1. 服务器启动：通过 `detectAuthConfig()` 检测认证模式
2. 工具调用：客户端发送 `tools/call` JSON-RPC 请求
3. 懒初始化：首次工具调用时创建 Gemini 客户端
4. 请求路由：`server.ts` 根据工具名分发至对应处理器
5. 模型解析：`getModelConfig()` 处理废弃映射，回退到默认模型
6. 凭证处理：Vertex AI 模式下，内联 JSON 凭证写入临时文件后由 SDK 读取

### 6.4 API 配置

| 参数 | 值 |
|------|-----|
| 超时时间 | 60,000 ms |
| 最大重试次数 | 3 次 |
| 重试间隔 | 1,000 ms |
| 最大图片大小 | 10 MB |
| MCP 协议版本 | 2024-11-05 |

---

## 7. 版本历史

| 版本 | 发布日期 | 主要变更 |
|------|---------|---------|
| **v1.4.0** | 2026-03 | 引入 Vertex AI 双模式认证；Windows 斜杠修复；临时文件凭证方案；支持 `GOOGLE_CREDENTIALS_JSON` 和原始 JSON 自动检测 |
| v1.3.1 | 2026-03 | Bug 修复；升级 @google/genai SDK |
| v1.3.0 | 2026-03 | 迁移至 gemini-3.1-pro-preview 为默认模型；废弃 gemini-3-pro-preview（2026-03-09 退役）；新增废弃模型自动映射 |
| v1.2.0 | 2026-01 | 精简为 5 个核心工具（删除 4 个低使用率工具）；所有工具新增 `model` 参数；新增 `gemini_search` |
| v1.1.0 | 2026-01 | 新增文件系统访问能力（`filePath` 参数） |
| v1.0.1 | 2025-12 | 基于 aliargun/mcp-server-gemini v4.2.2 的初始重写；8 个工具 |
