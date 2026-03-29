# v1.4.0 开发计划 — Vertex AI 双模式认证

> **对应 PRD**: `updatePRDv3.md`
> **版本**: v1.4.0
> **预计总工时**: ~2 小时
> **任务数**: 6 个
> **验收检查点**: 3 个

---

## 阶段 1: 核心认证架构（工厂函数重写）

> 重写认证层，所有后续改动都依赖此阶段。

### Task 1.1: 重写 `src/utils/gemini-factory.ts`（双模式工厂 + 环境检测）

- **优先级**: P0
- **预计时间**: 20 分钟
- **依赖**: 无
- **状态**: [x]

**文件操作**:
- 重写 `src/utils/gemini-factory.ts`

**AI 提示词**:

```
ultrathink
use context7

你是一位资深 TypeScript 开发专家，精通 Google @google/genai SDK 和 Vertex AI 认证体系。

请重写 src/utils/gemini-factory.ts，实现双模式认证（AI Studio Key + Vertex AI ADC）。

【当前代码】
export function createGeminiAI(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: API_CONFIG.timeout,
      retryOptions: {
        attempts: API_CONFIG.maxRetries + 1,
      },
    },
  });
}

【要求】

1. 新增类型定义：
   - AuthMode = 'api-key' | 'vertex-ai'
   - AuthConfig { mode, apiKey?, project?, location? }

2. 提取共享的 HTTP_OPTIONS 常量（timeout + retryOptions），两种模式复用

3. 重写 createGeminiAI(config: AuthConfig)：
   - mode === 'vertex-ai' 时：new GoogleGenAI({ vertexai: true, project, location, httpOptions })
   - mode === 'api-key' 时：new GoogleGenAI({ apiKey, httpOptions })

4. 新增 detectAuthConfig(): AuthConfig 函数，从环境变量自动检测：
   - GOOGLE_GENAI_USE_VERTEXAI === 'true' → Vertex AI 模式
     - 必须有 GOOGLE_CLOUD_PROJECT，缺失则 throw Error 并给出具体提示
     - GOOGLE_CLOUD_LOCATION 可选，默认 'us-central1'
   - GEMINI_API_KEY 存在 → AI Studio 模式
   - 两者都设置 → 优先 Vertex AI，console.error 打印 [WARN]
   - 都没有 → throw Error，提示用户配置（给出两种模式的示例）

5. 导出：AuthMode, AuthConfig, createGeminiAI, detectAuthConfig

SDK Vertex AI 构造方式参考（use context7 查阅 @google/genai 文档确认）：
new GoogleGenAI({
  vertexai: true,
  project: 'your_project',
  location: 'your_location',
})

Vertex AI 模式下 ADC 凭证由 SDK 自动查找：
- 环境变量 GOOGLE_APPLICATION_CREDENTIALS 指向的 JSON 文件
- gcloud auth application-default login 产生的本地凭证
- 云环境（GCE/Cloud Run/GKE）自带的元数据凭证

All code comments in English.
```

**验收标准**:
- [ ] `createGeminiAI({ mode: 'api-key', apiKey: 'xxx' })` 返回 GoogleGenAI 实例
- [ ] `createGeminiAI({ mode: 'vertex-ai', project: 'xxx', location: 'us-central1' })` 返回 GoogleGenAI 实例
- [ ] `detectAuthConfig()` 从环境变量正确检测模式
- [ ] 缺少必要环境变量时 throw 清晰的错误信息
- [ ] 两种模式都有 httpOptions（timeout + retry）
- [ ] TypeScript 编译无错误

**实际执行偏差**:
- AuthConfig 新增 `credentials?: Record<string, any>` 字段（PRD 未包含）
- 新增 `detectRawServiceAccountEnv()` 函数：自动检测粘贴到 MCP env 的原始 JSON
- 新增 `setupCredentialsTempFile()` 函数：将凭证写入临时文件供 SDK 读取
- 新增 `fixWindowsSlashCorruption()` 函数：修复 Windows 环境变量 `/` → `\` 腐蚀问题
- 支持 `GOOGLE_CREDENTIALS_JSON` 环境变量（整个 JSON 作为单个字符串）
- 默认 location 从 `us-central1` 改为 `global`（Gemini 3.x preview 模型必须用 global region）
- 实际范围远大于计划，耗时约 2 小时（含调试 Windows 腐蚀问题）

---

### Task 1.2: 修改 `src/utils/gemini-client.ts`（适配 AuthConfig）

- **优先级**: P0
- **预计时间**: 15 分钟
- **依赖**: Task 1.1
- **状态**: [x]

**文件操作**:
- 修改 `src/utils/gemini-client.ts`

**AI 提示词**:

```
你是一位资深 TypeScript 重构专家。

请修改 src/utils/gemini-client.ts，适配新的双模式认证架构。

【当前问题】
1. GeminiClient 构造函数接收 apiKey: string，直接传给 createGeminiAI(apiKey)
2. createGeminiClient(apiKey: string) 也接收 apiKey
3. getApiKey() 方法暴露了 raw apiKey
4. 这些在 Vertex AI 模式下都不适用（Vertex AI 没有 apiKey）

【修改方案】

1. GeminiClientConfig 接口改为：
   interface GeminiClientConfig {
     authConfig: AuthConfig;  // Replace apiKey with AuthConfig
     model?: string;
   }
   从 './gemini-factory.js' 导入 AuthConfig

2. 构造函数改为：
   constructor(config: GeminiClientConfig) {
     this.client = createGeminiAI(config.authConfig);
     this.modelId = config.model || getDefaultModel().id;
     this.config = { authConfig: config.authConfig, model: this.modelId };
   }

3. 移除 getApiKey() 方法 — Vertex AI 模式下没有 API key，此方法语义不再适用
   （当前只有 search.ts 用到它，Task 2.1 会改掉 search.ts）

4. createGeminiClient 函数签名改为：
   export function createGeminiClient(authConfig: AuthConfig, model?: string): GeminiClient
   内部：return new GeminiClient({ authConfig, model })

5. handleError() 方法保持不变
6. convertImageToInlineData() 保持不变（不涉及认证）

All code comments in English.
```

**验收标准**:
- [ ] `createGeminiClient(authConfig)` 接收 AuthConfig 参数
- [ ] getApiKey() 已移除
- [ ] GeminiClient 内部使用 `createGeminiAI(authConfig)`
- [ ] TypeScript 编译无错误

**实际执行偏差**:
- 新增 `getAI(): GoogleGenAI` 方法（供 analyze-codebase 使用）
- 这导致了计划外的 analyze-codebase.ts 改动

---

## ✅ 验收检查点 1: 认证架构层

> 暂停。验证工厂函数和客户端包装编译通过。

- [x] `src/utils/gemini-factory.ts` 编译通过，导出 AuthConfig / detectAuthConfig / createGeminiAI
- [x] `src/utils/gemini-client.ts` 编译通过，接收 AuthConfig
- [x] `npx tsc` 全局编译无错误（此时可能有上游调用者类型不匹配，在阶段 2 修复）

---

## 阶段 2: 上游调用适配（server.ts + search.ts）

> 修改入口文件和 search 工具，接入新的认证架构。

### Task 2.1: 修改 `src/server.ts`（使用 detectAuthConfig + 统一 search 调用）

- **优先级**: P0
- **预计时间**: 20 分钟
- **依赖**: Task 1.1, Task 1.2
- **状态**: [x]

**文件操作**:
- 修改 `src/server.ts`

**AI 提示词**:

```
ultrathink

你是一位资深 TypeScript 开发专家，精通 MCP 服务器架构。

请修改 src/server.ts，接入新的双模式认证架构。

【当前代码分析】

1. L14: import { createGeminiClient, GeminiClient } from './utils/gemini-client.js';
2. L40 附近: let geminiClient: GeminiClient | null = null; (类型是 GeminiClient)
3. L122-134: 初始化逻辑直接读 process.env.GEMINI_API_KEY
4. L158: handleSearch(args, process.env.GEMINI_API_KEY!) — search 单独传 apiKey

【修改要求】

1. 新增导入：
   import { detectAuthConfig } from './utils/gemini-factory.js';
   import { GoogleGenAI } from '@google/genai';

2. 变量声明改为两个：
   let geminiClient: GeminiClient | null = null;
   let geminiAI: GoogleGenAI | null = null;
   （geminiClient 给 4 个基于 GeminiClient 的工具用，geminiAI 给 search 直接用）

3. 初始化逻辑改为（替换 L122-134）：
   if (!geminiClient) {
     try {
       const authConfig = detectAuthConfig();
       geminiClient = createGeminiClient(authConfig);
       geminiAI = createGeminiAI(authConfig);
       console.error(`[INFO] Auth mode: ${authConfig.mode}${
         authConfig.mode === 'vertex-ai'
           ? ` (project: ${authConfig.project}, location: ${authConfig.location})`
           : ''
       }`);
     } catch (error: any) {
       sendError(request.id, ERROR_CODES.API_ERROR, error.message);
       return;
     }
   }

4. search 工具调用改为（替换 L158）：
   case TOOL_NAMES.SEARCH:
     result = await handleSearch(args, geminiAI!);
     break;

5. 其余 4 个工具的调用保持不变（仍用 geminiClient）

All code comments in English.
```

**验收标准**:
- [ ] 初始化使用 `detectAuthConfig()` 而非硬编码读 `GEMINI_API_KEY`
- [ ] 启动时打印认证模式信息 `[INFO] Auth mode: xxx`
- [ ] search 工具接收 `GoogleGenAI` 实例而非 apiKey 字符串
- [ ] 其余 4 个工具的调用不变
- [ ] 缺少环境变量时，返回清晰的 MCP 错误

**实际执行偏差**:
- 新增 `import { createGeminiAI }` 导入（search 工具需要 GoogleGenAI 实例）
- 认证模式日志包含 project 和 location 信息

---

### Task 2.2: 修改 `src/tools/search.ts`（接收 GoogleGenAI 实例）

- **优先级**: P0
- **预计时间**: 10 分钟
- **依赖**: Task 1.1
- **状态**: [x]

**文件操作**:
- 修改 `src/tools/search.ts`

**AI 提示词**:

```
你是一位资深 TypeScript 开发专家。

请修改 src/tools/search.ts，将 apiKey 参数改为接收 GoogleGenAI 实例。

【当前签名】
export async function handleSearch(
  params: SearchParams,
  apiKey: string
): Promise<SearchResult> {
  // ...
  const ai = createGeminiAI(apiKey);  // L73: 每次调用都创建新实例
  // ...使用 ai.models.generateContent(...)

【修改为】
import { GoogleGenAI } from '@google/genai';
// 移除 import { createGeminiAI } from '../utils/gemini-factory.js';  ← 不再需要

export async function handleSearch(
  params: SearchParams,
  ai: GoogleGenAI          // 直接接收已配置好的实例
): Promise<SearchResult> {
  // ...
  // 移除 L73 的 createGeminiAI(apiKey) 调用
  // 直接使用传入的 ai 参数
  // ...其余逻辑完全不变

【关键点】
- 只改函数签名和移除一行创建实例的代码
- GoogleSearch grounding 逻辑不动
- thinkingConfig 不动
- groundingMetadata 提取不动
- catch 块不动
- 默认模型仍为 'gemini-3-flash-preview'

All code comments in English.
```

**验收标准**:
- [ ] `handleSearch(params, ai: GoogleGenAI)` 签名正确
- [ ] 不再自行创建 GoogleGenAI 实例
- [ ] 不再依赖 `createGeminiAI` 导入
- [ ] Google Search Grounding 逻辑完整保留
- [ ] TypeScript 编译无错误

---

## ✅ 验收检查点 2: 功能完整

> 暂停。验证全部核心改动编译通过，双模式可用。

- [x] `npx tsc` 全局编译零错误
- [ ] 设置 `GEMINI_API_KEY` 启动 → AI Studio 模式正常（未在本次测试，但代码路径不变）
- [x] 设置 Vertex AI + Service Account → Vertex AI 模式正常
- [x] 不设置任何变量 → 清晰的错误提示
- [x] 5 个工具在 Vertex AI 模式下全部正常

---

## 阶段 3: 版本更新与文档

> 更新版本号、文档、发布。

### Task 3.1: 更新版本号和 CHANGELOG

- **优先级**: P0
- **预计时间**: 10 分钟
- **依赖**: 阶段 2 全部完成
- **状态**: [x]

**文件操作**:
- 修改 `src/config/constants.ts`（版本号 → 1.4.0）
- 修改 `package.json`（版本号 → 1.4.0）
- 修改 `CHANGELOG.md`（添加 v1.4.0 条目）

**AI 提示词**:

```
你是一位技术文档专家。

请更新以下文件：

1. src/config/constants.ts — SERVER_INFO.version 从 '1.3.1' 改为 '1.4.0'
2. package.json — version 从 '1.3.1' 改为 '1.4.0'
3. CHANGELOG.md — 在 v1.3.1 条目之前添加 v1.4.0 条目

CHANGELOG 内容要点：

## [1.4.0] - 2026-03-28

### Added
- Vertex AI authentication support via Application Default Credentials (ADC)
- Dual auth mode: AI Studio API Key + Vertex AI (auto-detected from environment variables)
- Auth mode logging on server startup (`[INFO] Auth mode: vertex-ai/api-key`)
- `detectAuthConfig()` function for automatic environment-based auth detection

### Changed
- `createGeminiAI()` now accepts `AuthConfig` object instead of raw API key string
- `handleSearch()` now receives `GoogleGenAI` instance instead of API key (consistent with other tools)
- `GeminiClient` constructor now accepts `AuthConfig` instead of `apiKey`
- Removed `getApiKey()` from GeminiClient (not applicable in Vertex AI mode)

### Environment Variables (Vertex AI mode)
- `GOOGLE_GENAI_USE_VERTEXAI=true` — Enable Vertex AI mode
- `GOOGLE_CLOUD_PROJECT` — GCP project ID (required)
- `GOOGLE_CLOUD_LOCATION` — Region, defaults to us-central1 (optional)
- `GOOGLE_APPLICATION_CREDENTIALS` — Service account JSON path (optional, for non-gcloud environments)

Match the existing CHANGELOG format. All in English.
```

**验收标准**:
- [ ] 版本号在 `constants.ts` 和 `package.json` 中一致为 `1.4.0`
- [ ] CHANGELOG v1.4.0 条目完整，位于 v1.3.1 之前

---

### Task 3.2: 更新 README.md（Vertex AI 配置指南）

- **优先级**: P0
- **预计时间**: 15 分钟
- **依赖**: Task 3.1
- **状态**: [x]

**文件操作**:
- 修改 `README.md`

**AI 提示词**:

```
你是一位技术文档专家，精通开源项目文档编写。

请在 README.md 的 Configuration / Setup 部分新增 Vertex AI 认证配置指南。

【要添加的内容】

在现有 GEMINI_API_KEY 配置说明之后，新增一个 "Authentication" 或 "认证方式" 章节：

### Authentication

This MCP server supports two authentication modes:

#### Option 1: AI Studio API Key (Simplest)

适合个人开发和快速试用。

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

> ⚠️ AI Studio keys may be subject to Google's usage policy restrictions.

#### Option 2: Vertex AI (Recommended for Production)

更安全，使用 Google Cloud IAM 认证。

**Prerequisites:**
1. A Google Cloud project with Vertex AI API enabled
2. One of: gcloud CLI login, service account JSON key, or cloud environment (GCE/Cloud Run/GKE)

**Setup with gcloud CLI (developers):**
```bash
gcloud auth application-default login
```

**MCP configuration:**
```json
{
  "mcpServers": {
    "gemini": {
      "command": "npx",
      "args": ["-y", "@lkbaba/mcp-server-gemini"],
      "env": {
        "GOOGLE_GENAI_USE_VERTEXAI": "true",
        "GOOGLE_CLOUD_PROJECT": "your-project-id",
        "GOOGLE_CLOUD_LOCATION": "us-central1"
      }
    }
  }
}
```

**With service account (servers/CI):**
Add `GOOGLE_APPLICATION_CREDENTIALS` pointing to your JSON key file.

【注意】
- 保持现有 README 结构和风格
- 在不破坏现有内容的前提下添加新章节
- 包名是 @lkbaba/mcp-server-gemini（不是 @anthropic）
- All in English
```

**验收标准**:
- [ ] README 包含两种认证方式的完整配置示例
- [ ] MCP 配置 JSON 示例可直接复制使用
- [ ] 包名正确（@lkbaba/mcp-server-gemini）
- [ ] 不破坏现有 README 内容

---

## ✅ 验收检查点 3: 最终发布

> 暂停。全面验收后决定是否编译发布。

- [x] 全部 6 个任务完成（实际变更 9 个文件）
- [x] `npx tsc` 编译零错误
- [ ] AI Studio Key 模式回归测试（代码路径不变，未单独测试）
- [x] Vertex AI 模式测试通过（gemini-3-flash-preview + gemini-3.1-pro-preview）
- [x] 版本号 1.4.0 正确
- [x] CHANGELOG 完整
- [x] README 包含 Vertex AI 配置指南
- [ ] 用户确认后执行 `npm run build` + `npm publish`

---

## 任务总览

| # | 任务 | 阶段 | 文件 | 时间 | 状态 |
|---|------|------|------|------|------|
| 1.1 | 重写 gemini-factory.ts（双模式 + detectAuthConfig） | 认证架构 | 重写 1 | 20m | [x] |
| 1.2 | 修改 gemini-client.ts（适配 AuthConfig） | 认证架构 | 改 1 | 15m | [x] |
| 2.1 | 修改 server.ts（detectAuthConfig + search 统一） | 调用适配 | 改 1 | 20m | [x] |
| 2.2 | 修改 search.ts（接收 GoogleGenAI 实例） | 调用适配 | 改 1 | 10m | [x] |
| 3.1 | 更新版本号 + CHANGELOG | 版本文档 | 改 3 | 10m | [x] |
| 3.2 | 更新 README（Vertex AI 指南） | 版本文档 | 改 1 | 15m | [x] |
| — | 计划外: 修改 analyze-codebase.ts | 调用适配 | 改 1 | 5m | [x] |
| — | 计划外: 修改 .gitignore | 安全 | 改 1 | 2m | [x] |
| — | 计划外: Windows 腐蚀调试与修复 | 认证架构 | 改 1 | 60m | [x] |
| — | 计划外: Vertex AI region 调试 (global) | 认证架构 | 改 1 | 30m | [x] |
| | **合计** | | **9 文件** | **~4h** | |

---

## 依赖关系图

```
Task 1.1 (gemini-factory.ts)
  ├── Task 1.2 (gemini-client.ts) ← 依赖 AuthConfig 类型
  │     └── Task 2.1 (server.ts) ← 依赖 createGeminiClient(authConfig)
  └── Task 2.2 (search.ts) ← 依赖新的 GoogleGenAI 实例

  ┌── 验收检查点 1 (编译通过)
  │
  ├── 验收检查点 2 (功能验证)
  │
Task 3.1 (版本号 + CHANGELOG)
  └── Task 3.2 (README)

  └── 验收检查点 3 (最终发布)
```
