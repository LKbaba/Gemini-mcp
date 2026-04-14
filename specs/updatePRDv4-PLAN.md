# updatePRDv4-PLAN.md — v1.5.0 开发计划

**关联 PRD**: `specs/updatePRDv4.md`  
**目标版本**: v1.5.0  
**日期**: 2026-04-13  
**状态**: 待执行

---

## 任务总览

| # | 任务 | 文件 | 类型 | 状态 |
|---|------|------|------|------|
| 1 | 核心修复：清除冲突 env var | `src/utils/gemini-factory.ts` | Bug Fix | [x] |
| 2 | 防御保护：添加 unhandledRejection 捕获 | `src/server.ts` | Bug Fix | [x] |
| 3 | 验证已有改动（超时、thinkingLevel） | `src/config/constants.ts` / `src/tools/search.ts` | Verify | [x] |
| 4 | 版本号更新至 1.5.0 | `src/config/constants.ts` | Chore | [x] |
| 5 | 构建验证 | `dist/` | Build | [x] |
| 6 | Git 提交 | — | Chore | [x] |
| 7 | 发布至 npm | npm | Release | [ ] |

---

## 验收检查点

- [ ] **检查点 A**：Task 1-2 完成后 — 代码修改验收（核心 bug fix）
- [ ] **检查点 B**：Task 3-4 完成后 — 配置验证验收
- [ ] **检查点 C**：Task 5 完成后 — 构建验收（无 TypeScript 错误）
- [ ] **检查点 D**：Task 6-7 完成后 — 发布验收

---

## Task 1：核心修复 — 清除冲突 env var

**文件**：`src/utils/gemini-factory.ts`  
**函数**：`createGeminiAI()`  
**状态**：[ ]

### 背景

`@google/genai` SDK 存在已知 bug (#616)：当 `process.env.GEMINI_API_KEY` 或 `process.env.GOOGLE_API_KEY` 存在时，即使 SDK 以 `vertexai:true` 初始化，SDK 内部仍会尝试走 AI Studio 认证路径，导致 unhandled promise rejection → Node.js 进程崩溃。

Claude-code-ChatInWindows 插件注入 `GEMINI_API_KEY="."` 作为占位符，触发此 bug，表现为 "Connection closed"。

### AI 提示词

```
你是一位精通 Node.js 运行时和 Google Generative AI SDK 的后端工程师。

任务：修改 `src/utils/gemini-factory.ts` 中的 `createGeminiAI()` 函数。

在 `config.mode === 'vertex-ai'` 分支内，`setupCredentialsTempFile()` 调用之后、`new GoogleGenAI({...})` 之前，插入以下两行代码：

    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;

注释要求（英文）：
    // Remove conflicting API key env vars before SDK initialization.
    // Known @google/genai SDK bug (#616): if GEMINI_API_KEY or GOOGLE_API_KEY
    // exist in process.env alongside vertexai:true, the SDK takes the wrong
    // auth path and throws an unhandled promise rejection, crashing Node.js.
    // Safe to delete here — we're in Vertex AI mode and don't need these keys.

不要修改函数的其他任何部分，不要添加多余注释或 log。
```

### 验收标准

- `createGeminiAI()` 的 `vertex-ai` 分支中出现 `delete process.env.GEMINI_API_KEY`
- `createGeminiAI()` 的 `vertex-ai` 分支中出现 `delete process.env.GOOGLE_API_KEY`
- API Key 分支（`else`）不受影响

---

## Task 2：防御保护 — 添加 unhandledRejection 捕获

**文件**：`src/server.ts`  
**函数**：`main()`  
**状态**：[ ]

### 背景

即使 Task 1 修复了根本原因，SDK 或其他依赖未来可能产生新的 unhandled rejection。没有全局捕获时，Node.js 只会静默终止进程，MCP 客户端只能看到 "Connection closed"，无从调试。

添加全局捕获后，至少能在 stderr 输出有意义的错误信息。

### AI 提示词

```
你是一位熟悉 Node.js 进程生命周期和 MCP 协议的后端工程师。

任务：修改 `src/server.ts` 中的 `main()` 函数。

在 `main()` 函数体内，`const rl = createInterface(...)` 之前，插入以下代码块：

  // Prevent silent crashes from unhandled promise rejections.
  // Without this, any unhandled rejection terminates the process and
  // the MCP client only sees "Connection closed" with no error details.
  process.on('unhandledRejection', (reason) => {
    console.error('[FATAL] Unhandled rejection — server will exit:', reason);
  });

注意事项：
- 不调用 process.exit()，保持 Node.js 默认退出行为（Node 18+ 会在输出日志后退出）
- 不要修改 SIGINT / SIGTERM 处理器
- 不要添加其他代码
```

### 验收标准

- `main()` 函数中存在 `process.on('unhandledRejection', ...)` 处理器
- 处理器位于 `createInterface(...)` 之前
- 处理器调用 `console.error` 输出错误信息，不调用 `process.exit()`

---

## ✅ 检查点 A — 代码修改验收

完成 Task 1 + Task 2 后暂停，人工检查以下内容：
1. `src/utils/gemini-factory.ts` 的 `createGeminiAI()` 函数是否正确添加了两行 `delete`
2. `src/server.ts` 的 `main()` 函数是否正确添加了 `unhandledRejection` 处理器
3. 两个文件其余部分是否未受影响

---

## Task 3：验证已有改动

**文件**：`src/config/constants.ts`、`src/tools/search.ts`、`src/tools/definitions.ts`  
**状态**：[ ]

### 说明

上一次对话中已完成以下改动，本 Task 仅做验证，确认无误：

### AI 提示词

```
你是一位代码审查工程师。

请验证以下文件中的改动是否已正确存在：

1. `src/config/constants.ts`：
   - API_CONFIG.timeout 的值是否为 120000（不是 60000）

2. `src/tools/search.ts`：
   - handleSearch() 中 thinkingLevel 默认值是否为 'low'（不是 'high'）
   - 注释是否包含 "reduces latency" 相关内容

3. `src/tools/definitions.ts`：
   - gemini_search 的 thinkingLevel 参数描述是否说明默认值是 'low'

请逐一读取这三个文件并确认。如果任何一项不符合预期，请报告具体差异，不要自行修复。
```

### 验收标准

- `timeout: 120000` ✅
- `thinkingLevel` 默认 `'low'` ✅  
- definitions.ts 描述与实际行为一致 ✅

---

## Task 4：版本号更新至 1.5.0

**文件**：`src/config/constants.ts`  
**状态**：[ ]

### AI 提示词

```
你是一位负责版本管理的工程师。

任务：修改 `src/config/constants.ts` 中 SERVER_INFO 对象的 version 字段。

将：
  version: '1.4.1',

改为：
  version: '1.5.0',

同时，修改 `package.json` 根目录文件中的 version 字段：
将 "version": "1.4.1" 改为 "version": "1.5.0"

只修改这两处版本号，不要动其他内容。
```

### 验收标准

- `src/config/constants.ts` 中 `version: '1.5.0'`
- `package.json` 中 `"version": "1.5.0"`

---

## ✅ 检查点 B — 配置验证验收

完成 Task 3 + Task 4 后暂停，确认：
1. 已有改动（超时 / thinkingLevel）均已存在
2. 版本号已更新至 1.5.0（constants.ts + package.json）

---

## Task 5：构建验证

**命令**：`npx tsc`  
**状态**：[ ]

### AI 提示词

```
你是一位 TypeScript 构建工程师。

任务：在项目根目录 `e:/Github/Gemini-mcp/` 运行 TypeScript 编译：

  npx tsc

要求：
- 必须零错误、零 error 输出才算通过
- 如有 TypeScript 错误，请完整报告错误信息（文件名、行号、错误类型）
- warning 可以忽略，但 error 必须修复
- 不要运行其他命令
```

### 验收标准

- `npx tsc` 退出码为 0（无错误）
- `dist/` 目录中对应文件已更新（`gemini-factory.js`、`server.js`、`constants.js`）

---

## ✅ 检查点 C — 构建验收

完成 Task 5 后暂停，确认：
1. `npx tsc` 无错误通过
2. `dist/utils/gemini-factory.js` 中包含 `delete process.env.GEMINI_API_KEY`
3. `dist/server.js` 中包含 `unhandledRejection` 相关代码

---

## Task 6：Git 提交

**状态**：[ ]

### AI 提示词

```
你是一位遵循约定式提交（Conventional Commits）规范的工程师。

任务：将以下文件暂存并提交：

暂存文件：
- src/utils/gemini-factory.ts
- src/server.ts  
- src/config/constants.ts
- src/tools/search.ts
- src/tools/definitions.ts
- package.json
- dist/utils/gemini-factory.js
- dist/utils/gemini-factory.js.map
- dist/server.js
- dist/server.js.map
- dist/config/constants.js
- dist/config/constants.js.map
- dist/tools/search.js
- dist/tools/search.js.map
- dist/tools/definitions.js
- dist/tools/definitions.js.map
- specs/updatePRDv4.md
- specs/updatePRDv4-PLAN.md

提交信息：
  fix(vertex-ai): remove conflicting API key env vars before SDK init (#616)

  - delete GEMINI_API_KEY/GOOGLE_API_KEY from process.env in Vertex AI mode
    to prevent @google/genai SDK from taking wrong auth path (bug #616)
  - add global unhandledRejection handler to prevent silent crashes
  - increase API timeout to 120s for Vertex AI + Pro model compatibility
  - set search default thinkingLevel to low for better latency
  - bump version to 1.5.0

注意：
- 使用 git add 逐个文件添加，不要用 git add -A 或 git add .
- 提交前先 git status 确认暂存区内容
```

### 验收标准

- `git log` 显示新的 commit，message 符合规范
- 无多余文件被意外提交

---

## Task 7：发布至 npm

**命令**：`npm publish --access public`  
**状态**：[ ]

### ⚠️ 注意

此步骤为不可逆操作，执行前必须确认：
- 检查点 C 已通过（构建无错误）
- Task 6 已完成（代码已提交）
- 用户已明确确认发布

### AI 提示词

```
你是一位负责 npm 包发布的工程师。

前置确认（在执行发布前，逐一输出以下信息供用户确认）：
1. 当前 package.json 中的 version 字段值
2. npm whoami（当前登录用户）
3. 将要发布的包名（name 字段）

确认无误后，执行：
  npm publish --access public

发布成功后，输出 npm 上的包链接格式：
  https://www.npmjs.com/package/@lkbaba/mcp-server-gemini/v/1.5.0
```

### 验收标准

- npm publish 成功，无错误
- npm 页面上可看到 v1.5.0

---

## ✅ 检查点 D — 发布验收

完成 Task 6 + Task 7 后，最终确认：
1. GitHub 仓库有新 commit
2. npm 上 `@lkbaba/mcp-server-gemini@1.5.0` 可以访问
3. 在 Claude Code 中更新 MCP 配置，重新测试插件内的 gemini_search 工具

---

## 附：快速测试方法

发布后，在 Claude-code-ChatInWindows 插件中测试：

```
调用 gemini_search，query: "今天的天气"
预期结果：返回搜索结果（不再出现 "Connection closed"）
```

如果仍出现问题，检查 MCP 服务器日志（stderr）是否有 `[FATAL] Unhandled rejection` 输出。
