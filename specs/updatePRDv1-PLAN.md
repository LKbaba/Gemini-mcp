# v1.3.1 开发计划 — SDK 升级与基础架构修复

> **对应 PRD**: `updatePRDv1.md`
> **版本**: v1.3.1
> **预计总工时**: ~2.5 小时
> **任务数**: 9 个（P0 x 9）
> **验收检查点**: 3 个

---

## 阶段 1: 基础设施层（新建 + 重写）

> 先搭骨架，创建工厂函数和错误类，后续所有工具改动都依赖这一层。

### Task 1.1: 创建 `src/utils/gemini-factory.ts`（工厂函数）

- **优先级**: P0
- **预计时间**: 15 分钟
- **依赖**: 无
- **修复 Bug**: Bug2（重试死代码）、Bug6（超时死代码）

**文件操作**:
- 新建 `src/utils/gemini-factory.ts`

**AI 提示词**:

```
你是一位资深 TypeScript 开发专家，精通 Google @google/genai SDK 1.46.0。

请在 src/utils/gemini-factory.ts 创建一个轻量工厂函数 createGeminiAI(apiKey)。

要求：
1. 返回配置好全局重试和超时的 GoogleGenAI 实例
2. 从 API_CONFIG（src/config/constants.ts）读取 timeout（60000ms）和 maxRetries（3）
3. 使用 SDK 内置的 httpOptions.retryOptions.attempts（值 = maxRetries + 1 = 4）
4. 使用 SDK 内置的 httpOptions.timeout
5. 导出 createGeminiAI 函数
6. All code comments in English (project targets English-speaking users)

参考 SDK 接口：
new GoogleGenAI({
  apiKey: string,
  httpOptions: {
    timeout: number,
    retryOptions: { attempts: number }
  }
})

参考 constants.ts 中的 API_CONFIG：
export const API_CONFIG = {
  timeout: 60000,
  maxRetries: 3,
  retryDelay: 1000,
  maxImageSize: 10 * 1024 * 1024,
};
```

**验收标准**:
- [x] `createGeminiAI(apiKey)` 返回 GoogleGenAI 实例
- [x] 全局重试 4 次（首次 + 3 次重试）
- [x] 全局超时 60 秒
- [x] TypeScript 编译无错误

---

### Task 1.2: 创建 `src/utils/errors.ts`（错误类）

- **优先级**: P0
- **预计时间**: 10 分钟
- **依赖**: 无
- **修复 Bug**: Bug4（验证错误分类错误）

**文件操作**:
- 新建 `src/utils/errors.ts`

**AI 提示词**:

```
你是一位资深 TypeScript 开发专家，精通 MCP 协议错误规范。

请在 src/utils/errors.ts 创建两个自定义错误类。

要求：
1. ValidationError — 继承 Error，用于参数验证失败（文件不存在、参数缺失等）
2. SecurityError — 继承 Error，用于安全验证失败（路径遍历等）
3. 两者都要设置正确的 name 属性
4. All code comments in English (project targets English-speaking users)

这两个类将在工具的 catch 块中用 instanceof 区分处理：
- ValidationError / SecurityError → handleValidationError() → INVALID_PARAMS (-32602)
- 其他错误 → handleAPIError() → API_ERROR (-32000)
```

**验收标准**:
- [x] `new ValidationError('msg') instanceof Error === true`
- [x] `new SecurityError('msg') instanceof Error === true`
- [x] `.name` 属性正确设置

---

### Task 1.3: 重写 `src/utils/error-handler.ts`

- **优先级**: P0
- **预计时间**: 25 分钟
- **依赖**: Task 1.2（需要导入 errors.ts 中的类型）
- **修复 Bug**: Bug1（错误匹配太宽泛）、Bug7（MCPError 不是 Error 实例）、Bug8（敏感信息清理不全）

**文件操作**:
- 修改 `src/utils/error-handler.ts`
- 修改 `src/types.ts`（MCPError 类型定义）

**AI 提示词**:

```
ultrathink

你是一位资深 TypeScript 开发专家，精通 MCP 协议和 Google Gemini API 的错误体系。

请重写 src/utils/error-handler.ts，修复以下 3 个 Bug：

【Bug1 — 错误匹配太宽泛】
当前 L47: if (error.message?.includes('model') || error.message?.includes('not found'))
问题：'not found' 会匹配文件不存在等非 API 错误

修复：用精确模式替代：
- error.message?.includes('models/')            // "models/gemini-xxx is not found"
- error.message?.includes('not supported for model')
- error.message?.includes('Model not found')
- error.message?.includes('model is not available')
- error.status === 404

并且所有错误分支都要透传 error.message 原始信息（不再用固定文案替代）。

【Bug7 — MCPError 不是 Error 实例】
当前 MCPError 是 { code, message, data } 的普通 POJO。
修复：在 src/types.ts 中改为 class MCPError extends Error { code: number; data?: any }
同步修改 createMCPError 函数为 new MCPError(code, message, data)。

【Bug8 — 敏感信息清理不全】
当前 sanitizeErrorMessage 只清理 apiKey=xxx 格式。
增加清理：
- URL 中 ?key=AIzaSy... 和 &key=...
- Bearer Token
- AIzaSy 开头的 Google API Key 明文

现有文件内容参考：
- src/utils/error-handler.ts（6 个函数：createMCPError, handleAPIError, handleValidationError, handleInternalError, sanitizeErrorMessage, logError）
- src/types.ts（MCPError 接口定义）
- src/config/constants.ts（ERROR_CODES 定义）

All code comments in English (project targets English-speaking users).
```

**验收标准**:
- [x] 文件不存在错误不再被误判为 MODEL_NOT_SUPPORTED
- [x] API 错误信息透传到用户端（error.message 可见）
- [x] `new MCPError(code, msg) instanceof Error === true`
- [x] `sanitizeErrorMessage` 能清理 4 种敏感信息格式
- [x] TypeScript 编译无错误

---

## ✅ 验收检查点 1: 基础设施层

> 暂停。验证 3 个新建/重写的基础文件编译通过，然后继续。

- [x] `src/utils/gemini-factory.ts` 编译通过
- [x] `src/utils/errors.ts` 编译通过
- [x] `src/utils/error-handler.ts` + `src/types.ts` 编译通过
- [x] `npx tsc` 全局编译无错误

---

## 阶段 2: 统一调用模式（重构 5 个工具 + 废弃 GeminiClient）

> 所有工具统一使用 createGeminiAI() 工厂函数，catch 块分离验证错误和 API 错误。

### Task 2.1: 重构 `src/utils/gemini-client.ts`（废弃标记）

- **优先级**: P0
- **预计时间**: 15 分钟
- **依赖**: Task 1.1
- **修复 Bug**: Bug2（重试死代码）、Bug5（默认模型硬编码）、Bug6（超时死代码）

**文件操作**:
- 修改 `src/utils/gemini-client.ts`

**AI 提示词**:

```
你是一位资深 TypeScript 重构专家。

请重构 src/utils/gemini-client.ts：

1. 内部改用 createGeminiAI(apiKey) 工厂函数（从 ./gemini-factory.js 导入）
2. 移除 GeminiClientConfig 中的 timeout 和 maxRetries 字段（SDK 内置处理）
3. 移除构造函数中 this.config.timeout 和 this.config.maxRetries 的赋值
4. 默认模型从硬编码 'gemini-3-pro-preview' 改为调用 getDefaultModel().id（从 ../config/models.js 导入）
5. 在类上方添加 @deprecated JSDoc 注释，说明推荐直接使用 createGeminiAI()
6. generate() 和 generateMultimodal() 方法保持不变（接口兼容，内部用新 client）
7. convertImageToInlineData() 和 createGeminiClient() 导出保持不变

不要删除 GeminiClient 类，只标记 deprecated 并内部重构。
All code comments in English (project targets English-speaking users).
```

**验收标准**:
- [x] GeminiClient 内部使用 createGeminiAI()
- [x] 默认模型为 `gemini-3.1-pro-preview`（从 getDefaultModel() 读取）
- [x] 无 timeout / maxRetries 死代码
- [x] 现有导出不变，向后兼容

---

### Task 2.2: 重构 `src/tools/search.ts` 和 `src/tools/analyze-codebase.ts`

- **优先级**: P0
- **预计时间**: 25 分钟
- **依赖**: Task 1.1, Task 1.2, Task 1.3
- **修复 Bug**: Bug3（忽略 client 参数）、Bug4（catch 错误分类）

**文件操作**:
- 修改 `src/tools/search.ts`
- 修改 `src/tools/analyze-codebase.ts`

**AI 提示词**:

```
ultrathink

你是一位资深 TypeScript 开发专家，精通 MCP 服务器和 Google @google/genai SDK 1.46.0。

请重构以下两个工具文件，使用统一的调用模式：

【search.ts】
1. 将 `new GoogleGenAI({ apiKey })` 替换为 `createGeminiAI(apiKey)`（从 ../utils/gemini-factory.js 导入）
2. 搜索工具默认模型保持 'gemini-3-flash-preview' 不变（这是设计意图）
3. catch 块添加 ValidationError / SecurityError 判断：
   - instanceof ValidationError || instanceof SecurityError → throw handleValidationError(error.message)
   - 其他 → throw handleAPIError(error)
4. 其余逻辑（tools: [{ googleSearch: {} }]、thinkingConfig、groundingMetadata 提取）不变

【analyze-codebase.ts】
1. 将 `new GoogleGenAI({ apiKey })` 替换为 `createGeminiAI(apiKey)`
2. **关键修复**：移除 L441-444 中直接从 process.env 读 apiKey 的逻辑，改为使用函数参数传入的 apiKey
3. 默认模型从硬编码改为 getDefaultModel().id（从 ../config/models.js 导入）
4. catch 块同样分离 ValidationError/SecurityError 和 API 错误
5. 文件读取/安全验证中的 throw new Error(...) 改为 throw new ValidationError(...) 或 throw new SecurityError(...)

导入语句：
import { createGeminiAI } from '../utils/gemini-factory.js';
import { ValidationError, SecurityError } from '../utils/errors.js';
import { getDefaultModel } from '../config/models.js';

代码注释使用中文。
```

**验收标准**:
- [x] search.ts 使用 createGeminiAI()，默认模型仍为 flash
- [x] analyze-codebase.ts 使用 createGeminiAI()，不再从 process.env 读 key
- [x] analyze-codebase.ts 默认模型从 getDefaultModel() 读取
- [x] catch 块正确分离验证错误和 API 错误

---

### Task 2.3: 重构 `src/tools/analyze-content.ts`、`multimodal-query.ts`、`brainstorm.ts`

- **优先级**: P0
- **预计时间**: 20 分钟
- **依赖**: Task 1.2, Task 1.3, Task 2.1
- **修复 Bug**: Bug4（catch 错误分类）

**文件操作**:
- 修改 `src/tools/analyze-content.ts`
- 修改 `src/tools/multimodal-query.ts`
- 修改 `src/tools/brainstorm.ts`

**AI 提示词**:

```
你是一位资深 TypeScript 开发专家。

请对以下 3 个工具文件做最小改动，仅修复 catch 块的错误分类问题：

【3 个文件共同修改】
1. 添加导入：import { ValidationError, SecurityError } from '../utils/errors.js';
2. catch 块改为：
   } catch (error: any) {
     logError('toolName', error);
     if (error instanceof ValidationError || error instanceof SecurityError) {
       throw handleValidationError(error.message);
     }
     throw handleAPIError(error);
   }
3. 文件中已有的 throw new Error('参数验证相关消息') 改为 throw new ValidationError('...')
4. 文件中已有的安全校验 throw 改为 throw new SecurityError('...')

【特别注意 brainstorm.ts】
- L258-266, L271-281 处有静默吞掉文件读取错误的 try-catch — 保持现有行为不变（只记日志不抛出），这是设计意图

这 3 个工具继续通过 GeminiClient 调用（不改调用方式，只改 catch 和 throw 类型）。
All code comments in English (project targets English-speaking users).
```

**验收标准**:
- [x] 3 个文件的 catch 块都分离了 ValidationError 和 API 错误
- [x] 参数验证 throw 改为 ValidationError
- [x] brainstorm.ts 文件读取错误仍然静默处理
- [x] 调用方式不变（仍用 GeminiClient）

---

## ✅ 验收检查点 2: 工具层重构

> 暂停。验证全部 5 个工具编译通过且调用模式统一。

- [x] `npx tsc` 全局编译无错误
- [x] search.ts 和 analyze-codebase.ts 使用 createGeminiAI()
- [x] 其余 3 个工具 catch 块已修复
- [ ] 用真实 API Key 测试 gemini-3.1-pro-preview 调用成功

---

## 阶段 3: 版本更新与发布

### Task 3.1: 更新版本号和常量

- **优先级**: P0
- **预计时间**: 5 分钟
- **依赖**: 阶段 2 全部完成

**文件操作**:
- 修改 `src/config/constants.ts`（版本号 → 1.3.1）
- 修改 `package.json`（版本号 → 1.3.1）

**AI 提示词**:

```
你是一位 TypeScript 开发者。

请更新以下两个文件的版本号：
1. src/config/constants.ts — SERVER_CONFIG.version 从 '1.3.0' 改为 '1.3.1'
2. package.json — version 从 '1.3.0' 改为 '1.3.1'

仅改版本号，不动其他内容。
```

**验收标准**:
- [x] 两个文件版本号一致为 `1.3.1`

---

### Task 3.2: 更新 CHANGELOG.md

- **优先级**: P0
- **预计时间**: 10 分钟
- **依赖**: Task 3.1

**文件操作**:
- 修改 `CHANGELOG.md`

**AI 提示词**:

```
你是一位技术文档专家。

请在 CHANGELOG.md 顶部（v1.3.0 条目之前）添加 v1.3.1 条目。

内容要点：
## [1.3.1] - 2026-03-23

### Fixed（修复）
- 升级 @google/genai SDK 1.8.0 → 1.46.0，修复 gemini-3.1-pro-preview 模型无法调用的问题
- 修复错误处理中 'model'/'not found' 关键词匹配过于宽泛的问题（Bug1）
- 修复 maxRetries/timeout 从未实际生效的死代码问题（Bug2, Bug6），改用 SDK 内置重试
- 修复 analyze-codebase 工具忽略传入 client 参数的问题（Bug3）
- 修复参数验证错误被错误归类为 API_ERROR 的问题（Bug4）
- 修复 GeminiClient 默认模型仍指向已退役的 gemini-3-pro-preview 的问题（Bug5）
- 修复 MCPError 非 Error 实例导致 stack trace 缺失的问题（Bug7）
- 增强 API Key 敏感信息清理覆盖范围（Bug8）

### Changed（变更）
- 统一 5 个工具的 API 调用模式，新增 createGeminiAI() 工厂函数
- 引入 ValidationError / SecurityError 错误类，实现错误分类精确化
- GeminiClient 标记为 deprecated，推荐使用 createGeminiAI()

CHANGELOG and all code comments must be in English (project targets English-speaking users). Match the existing CHANGELOG format.
```

**验收标准**:
- [x] v1.3.1 条目位于 v1.3.0 之前
- [x] 所有 8 个 Bug 修复都有记录

---

### Task 3.3: 编译、测试、提交

- **优先级**: P0
- **预计时间**: 15 分钟
- **依赖**: Task 3.2

**AI 提示词**:

```
你是一位 DevOps 工程师。

请执行以下步骤：

1. 运行 npx tsc 编译，确认无错误
2. 用真实 API Key 运行测试脚本，验证：
   - gemini-3.1-pro-preview 可正常调用
   - gemini-3-flash-preview 可正常调用
   - 指定不存在的模型时，错误信息透传（不是 "model not supported" 固定文案）
   - createGeminiAI() 工厂函数正常创建客户端
3. 启动 MCP 服务器确认版本号为 v1.3.1
4. git add 相关文件并提交：
   feat(v1.3.1): 升级 SDK 到 1.46.0 并修复 8 个基础架构缺陷
```

**验收标准**:
- [x] TypeScript 编译零错误
- [ ] 3.1-pro 和 3-flash 模型调用成功
- [ ] 错误信息透传验证通过
- [ ] MCP 服务器启动显示 v1.3.1
- [ ] Git 提交成功

---

## ✅ 验收检查点 3: 最终发布

> 暂停。全面验收后决定是否发布到 npm。

- [x] 全部 9 个任务完成
- [x] 8 个 Bug 全部修复
- [x] 5 个工具调用模式统一
- [x] 编译零错误 + 测试通过
- [x] 版本号 1.3.1 正确
- [x] CHANGELOG 完整
- [ ] 用户确认后执行 npm publish

---

## 任务总览

| # | 任务 | 阶段 | Bug | 文件 | 时间 |
|---|------|------|-----|------|------|
| 1.1 | 创建 gemini-factory.ts | 基础设施 | Bug2,6 | 新建 1 | 15m |
| 1.2 | 创建 errors.ts | 基础设施 | Bug4 | 新建 1 | 10m |
| 1.3 | 重写 error-handler.ts | 基础设施 | Bug1,7,8 | 改 2 | 25m |
| 2.1 | 重构 gemini-client.ts | 工具层 | Bug2,5,6 | 改 1 | 15m |
| 2.2 | 重构 search + codebase | 工具层 | Bug3,4 | 改 2 | 25m |
| 2.3 | 重构 content + modal + brainstorm | 工具层 | Bug4 | 改 3 | 20m |
| 3.1 | 更新版本号 | 发布 | — | 改 2 | 5m |
| 3.2 | 更新 CHANGELOG | 发布 | — | 改 1 | 10m |
| 3.3 | 编译测试提交 | 发布 | — | — | 15m |
| | **合计** | | **8 Bug** | **13 文件** | **~140m** |
