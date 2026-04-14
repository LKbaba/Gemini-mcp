# updatePRD v4.0 — Fix "Connection closed" Crash in Claude-code-ChatInWindows Plugin

**Version**: 1.5.0  
**Date**: 2026-04-13  
**Author**: LKbaba  
**Status**: Pending Confirmation

---

## 1. 问题描述

在 Claude-code-ChatInWindows VS Code 插件中使用 `@lkbaba/mcp-server-gemini` 时，调用任意 Gemini 工具后出现 **"Connection closed"** 错误。

- 其他 MCP 服务器（如 filesystem、playwright 等）在同一插件中正常工作
- 单独在 Claude Code CLI 中使用 Gemini MCP 也正常工作
- 只有在该插件内部调用 Gemini MCP 工具时才会崩溃

**现象区别**：
- `isError: true`（工具返回错误）= API 调用失败，服务器仍在运行 ✅
- `"Connection closed"`（连接断开）= 服务器进程已崩溃 ❌ ← 我们遇到的情况

---

## 2. 根本原因分析

### 2.1 插件的 env 注入行为

该插件在启动 MCP 服务器时，会同时注入以下环境变量：

```
GEMINI_API_KEY="."              ← 占位符，不是真实 Key
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CREDENTIALS_JSON={...}  ← 完整 Service Account JSON
GOOGLE_CLOUD_PROJECT=vertex-ai-491703
```

插件设计意图：`GEMINI_API_KEY="."` 只是一个占位符，真正使用 Vertex AI 认证。

### 2.2 `@google/genai` SDK 的已知 Bug

**Bug 编号**：issues #616、#426、#487（官方 GitHub 仓库）

**触发条件**：`process.env.GEMINI_API_KEY` 存在，同时 SDK 以 `vertexai: true` 模式初始化。

**行为**：SDK 内部在检测认证模式时，看到 `GEMINI_API_KEY` 存在就走了 AI Studio 认证路径，但同时又配置了 `vertexai: true`，导致认证逻辑冲突，抛出一个**未捕获的 Promise rejection**。

**后果**：Node.js 15+ 默认行为——未处理的 Promise rejection 会直接终止进程 → 服务器崩溃 → MCP 客户端收到 "Connection closed"。

### 2.3 为什么其他 MCP 服务器不受影响

其他服务器（filesystem、playwright 等）不使用 `@google/genai` SDK，不存在这个 env var 冲突问题。问题完全在于 `@google/genai` SDK 的这个已知 bug。

### 2.4 Auth 优先级逻辑（现状）

`detectAuthConfig()` 当前已实现正确的优先级：

```
Vertex AI (GOOGLE_GENAI_USE_VERTEXAI=true) → 优先
Raw SA JSON env → 次之  
API Key → 最后
```

逻辑本身没错，**问题出在 `createGeminiAI()` 创建 SDK 实例时，`GEMINI_API_KEY` 这个 env var 仍然留在 `process.env` 中**，SDK 在初始化时会自动读取 env，导致冲突。

---

## 3. 修复方案

### Fix 1（核心修复）：创建 SDK 前清除冲突 env var

**文件**：`src/utils/gemini-factory.ts`  
**函数**：`createGeminiAI()`

在 Vertex AI 模式下创建 `GoogleGenAI` 实例之前，删除 `GEMINI_API_KEY` 和 `GOOGLE_API_KEY`，防止 SDK 走错认证路径。

**修改前**：
```typescript
export function createGeminiAI(config: AuthConfig): GoogleGenAI {
  if (config.mode === 'vertex-ai') {
    if (config.credentials) {
      setupCredentialsTempFile(config.credentials);
    }

    return new GoogleGenAI({
      vertexai: true,
      project: config.project,
      location: config.location,
      httpOptions: HTTP_OPTIONS,
    });
  }

  return new GoogleGenAI({
    apiKey: config.apiKey,
    httpOptions: HTTP_OPTIONS,
  });
}
```

**修改后**：
```typescript
export function createGeminiAI(config: AuthConfig): GoogleGenAI {
  if (config.mode === 'vertex-ai') {
    if (config.credentials) {
      setupCredentialsTempFile(config.credentials);
    }

    // Remove conflicting API key env vars before SDK initialization.
    // Known @google/genai SDK bug (#616): if GEMINI_API_KEY or GOOGLE_API_KEY
    // exist in process.env alongside vertexai:true, the SDK takes the wrong
    // auth path and throws an unhandled promise rejection, crashing Node.js.
    // Safe to delete here — we're in Vertex AI mode and don't need these keys.
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;

    return new GoogleGenAI({
      vertexai: true,
      project: config.project,
      location: config.location,
      httpOptions: HTTP_OPTIONS,
    });
  }

  return new GoogleGenAI({
    apiKey: config.apiKey,
    httpOptions: HTTP_OPTIONS,
  });
}
```

**影响范围**：
- Vertex AI 模式：移除 env 冲突，崩溃问题解决 ✅
- API Key 模式：不进入 `if` 分支，不受影响 ✅
- 副作用：`process.env.GEMINI_API_KEY` 被删除，但在 Vertex AI 模式下本就不需要它

---

### Fix 2（防御性保护）：添加全局 unhandledRejection 捕获

**文件**：`src/server.ts`  
**位置**：`main()` 函数内，readline 初始化之前

即使修复了根本原因，也应该添加全局的 unhandled rejection 捕获，防止未来其他地方出现类似问题时导致静默崩溃。

**新增代码**（在 `main()` 函数中，`rl` 定义之前）：
```typescript
// Prevent silent crashes from unhandled promise rejections.
// Without this, any unhandled rejection will terminate the Node.js process
// and the MCP client only sees "Connection closed" with no error details.
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection — server will exit:', reason);
});
```

**注意**：这里不调用 `process.exit()`，让 Node.js 默认行为继续（Node 18+ 会退出），但至少会在 stderr 输出有意义的错误信息，便于调试。

---

## 4. 已有改动（上一次对话中已完成，待确认）

以下改动已在代码中存在，本次版本一并纳入：

### 4.1 超时时间：60s → 120s

**文件**：`src/config/constants.ts`

```typescript
// 原来
timeout: 60000,

// 现在
timeout: 120000, // 120 seconds — Vertex AI + Pro models need more time
```

**原因**：Vertex AI + Pro 模型（如 `gemini-3.1-pro-preview`）响应时间较长，60s 不够用；实测最慢约 18s（Pro + Search + high thinking），120s 足够应对高负载情况。

### 4.2 Search 默认 thinkingLevel：high → low

**文件**：`src/tools/search.ts` + `src/tools/definitions.ts`

```typescript
// 原来
const thinkingLevel = params.thinkingLevel || 'high';

// 现在
const thinkingLevel = params.thinkingLevel || 'low';
// Default to 'low' for search — reduces latency, avoids MCP timeout on Vertex AI
```

**原因**：实测数据显示 `high` thinking 对 search 结果质量提升有限，但延迟显著增加（8.5s vs 7.1s）；MCP 客户端存在 ~60s 工具调用超时，搜索工具用 `low` 更稳定。

---

## 5. 版本号规划

| 变更类型 | 描述 |
|---------|------|
| Bug Fix | Fix Vertex AI + API Key env var conflict crash (#616) |
| Bug Fix | Add unhandledRejection handler to prevent silent crashes |
| Improvement | Increase timeout to 120s for Vertex AI compatibility |
| Improvement | Change search default thinkingLevel to low for better latency |

建议版本号：**v1.5.0**（新增防御性机制 + 重要 bug 修复，值得 minor version 升级）

---

## 6. 实施步骤

确认本文档后，按以下顺序实施：

1. **修改 `src/utils/gemini-factory.ts`**：在 `createGeminiAI()` Vertex AI 分支中添加 `delete process.env.GEMINI_API_KEY` 和 `delete process.env.GOOGLE_API_KEY`
2. **修改 `src/server.ts`**：在 `main()` 中添加 `process.on('unhandledRejection', ...)` 处理器
3. **修改 `src/config/constants.ts`**：更新版本号为 `1.5.0`（已有超时改动）
4. **构建**：`npx tsc`
5. **发布**：`npm publish --access public`

---

## 7. 安全提醒

`E:\Github\Claude-code-ChatInWindows\debug_log.txt` 文件中包含完整的 Service Account 私钥（`private_key` 字段），请注意：
- 不要提交该文件到 git 仓库
- 如果已提交或共享，建议在 GCP Console 中吊销该 Service Account 密钥并重新生成
