# updatePRD v2.0.0 — 功能升级：利用 SDK 1.46 新能力扩展 MCP 工具集

> **版本**: v2.0.0（主版本）
> **优先级**: P1 — 重要但不紧急
> **日期**: 2026-03-23
> **前置依赖**: v1.3.1 修复完成
> **类型**: 新功能 + 增强

---

## 1. 执行摘要

`@google/genai` SDK 从 1.8.0 升级到 1.46.0 后，解锁了大量新能力。本文档规划如何利用这些能力扩展 MCP 工具集，从当前 5 个工具扩展到 7-8 个工具，同时增强现有工具的能力。

**核心原则：只做高价值、用户可感知的升级，不为了用新 API 而用。**

---

## 1.1 实测验证结果（2026-03-23 用真实 API Key + SDK 1.46.0 测试）

| 新能力 | 测试结果 | 关键细节 |
|--------|---------|---------|
| **代码执行** | ✅ 完美可用 | 自动生成 Python 代码并执行，返回 `OUTCOME_OK` + 执行输出 |
| **图片生成 Imagen 4** | ✅ 完美可用 | 生成 305KB PNG，模型 ID: `imagen-4.0-generate-001`（非 Imagen 3） |
| **File API 上传** | ✅ 完美可用 | 上传→ACTIVE→分析→删除 全流程通过 |
| **ThinkingLevel** | ⚠️ 3 级可用 | `LOW` ✅ `MEDIUM` ✅ `HIGH` ✅ `MINIMAL` ❌（3.1 Pro 不支持） |
| **SDK 全局重试** | ✅ 可用 | `GoogleGenAI({ httpOptions: { retryOptions: { attempts: 3 } } })` |
| **SDK 请求级重试** | ✅ 可用 | `config.httpOptions.retryOptions` |

### 实测修正项
- ❌ PRD 原写 `imagen-3.0-generate-002` → ✅ 应为 **`imagen-4.0-generate-001`**（已升级到 Imagen 4）
- ❌ PRD 原写 ThinkingLevel 4 级 → ✅ 实际只有 **3 级**（`MINIMAL` 不支持 gemini-3.1-pro-preview）
- ✅ 你的 AI Studio Key 支持 Imagen 4（无需 Vertex AI），降低了集成风险

---

## 2. SDK 1.46.0 能力评估矩阵

| SDK 新能力 | 用户价值 | 实现难度 | 是否采纳 | 理由 |
|-----------|---------|---------|---------|------|
| **代码执行** `codeExecution` | ⭐⭐⭐ | 低 | ✅ 采纳 | Claude 自身无法运行代码，Gemini 可以直接执行 Python，互补性极强 |
| **图片生成** `generateImages` | ⭐⭐⭐ | 中 | ✅ 采纳 | 当前只能"看图"不能"生图"，加上此功能是质变 |
| **File API** 大文件上传 | ⭐⭐ | 中 | ✅ 采纳 | 解决代码库分析工具对大项目的 token 限制问题 |
| **ThinkingLevel 扩展** | ⭐⭐ | 低 | ✅ 采纳 | 当前只有 low/high，新增 minimal/medium 更精细 |
| **ThinkingBudget** token 预算 | ⭐ | 低 | ✅ 附带采纳 | 和 ThinkingLevel 一起实现，给高级用户更精细的控制 |
| Live API 实时流 | ⭐ | 高 | ❌ 不采纳 | MCP 是请求-响应模式，不支持持久连接 |
| Interactions API | ⭐ | 高 | ❌ 不采纳 | 有状态会话与 MCP 无状态设计冲突 |
| Veo 视频生成 | ⭐ | 中 | ❌ 不采纳 | 太 niche，MCP 用户场景极少需要视频 |
| Google Maps 工具 | ⭐ | 低 | ❌ 不采纳 | 与项目"前端开发"定位不符 |
| 本地 Tokenizer | ⭐ | 低 | ❌ 不采纳 | 锦上添花，非用户痛点 |

---

## 3. 新增工具设计

### 3.1 gemini_code_execution — 代码执行工具

**用户痛点**: Claude 自身无法运行代码验证结果。用户需要手动复制代码到终端执行。Gemini 的代码执行能力可以填补这个空缺。

**典型场景**:
- "帮我算一下这个正则表达式能匹配哪些字符串"
- "用 Python 验证一下这个数学公式"
- "分析这份 CSV 数据的统计分布"
- "运行这段算法看看输出是什么"

**SDK 接口**:

```typescript
// Gemini API 用法
const response = await ai.models.generateContent({
  model: 'gemini-3.1-pro-preview',
  contents: [{ role: 'user', parts: [{ text: prompt }] }],
  config: {
    tools: [{ codeExecution: {} }],  // 启用代码执行
  }
});

// 返回结果中包含：
// - ExecutableCodePart: { executableCode: { code: string, language: 'PYTHON' } }
// - CodeExecutionResultPart: { codeExecutionResult: { output: string, outcome: 'OUTCOME_OK' | 'OUTCOME_FAILED' | ... } }
```

**MCP 工具定义**:

```typescript
{
  name: 'gemini_code_execution',
  description: '使用 Gemini 执行 Python 代码。适合数学计算、数据分析、正则验证、算法验证等场景。',
  inputSchema: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: '要执行的任务描述（Gemini 会自动生成并执行代码）'
      },
      code: {
        type: 'string',
        description: '（可选）指定要执行的 Python 代码。如果提供，Gemini 会直接执行此代码'
      },
      context: {
        type: 'string',
        description: '（可选）附加上下文信息'
      },
      model: {
        type: 'string',
        enum: ['gemini-3.1-pro-preview', 'gemini-3-flash-preview'],
        description: '（可选）使用的模型'
      }
    },
    required: ['task']
  }
}
```

**返回格式**:

```json
{
  "task": "计算斐波那契数列第 50 项",
  "generatedCode": "def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a\n\nprint(fib(50))",
  "executionResult": {
    "output": "12586269025",
    "outcome": "OUTCOME_OK"
  },
  "explanation": "使用迭代法计算，避免递归的栈溢出问题...",
  "metadata": {
    "modelUsed": "gemini-3.1-pro-preview",
    "language": "PYTHON"
  }
}
```

**实现文件**: `src/tools/code-execution.ts`（新增）

---

### 3.2 gemini_generate_image — 图片生成工具

**用户痛点**: 前端开发中经常需要占位图、图标、UI 概念图。目前项目只能分析图片，无法生成图片。

**典型场景**:
- "生成一个电商 App 的 Landing Page 概念图"
- "帮我画一个深色主题的 Dashboard 布局参考"
- "生成一组 Material Design 风格的图标"
- "根据我的描述生成 UI wireframe"

**SDK 接口**:

```typescript
const response = await ai.models.generateImages({
  model: 'imagen-4.0-generate-001',  // 或其他可用的 Imagen 模型
  prompt: '描述文字',
  config: {
    numberOfImages: 1,
    aspectRatio: '16:9',
    language: 'zh',               // 支持中文提示词
    safetyFilterLevel: 'BLOCK_MEDIUM_AND_ABOVE',
    personGeneration: 'ALLOW_ADULT',
    outputMimeType: 'image/png',
    addWatermark: true,
  }
});

// 返回：
// response.generatedImages[0].image.imageBytes  — base64 图片数据
```

**MCP 工具定义**:

```typescript
{
  name: 'gemini_generate_image',
  description: '使用 Google Imagen 生成图片。适合 UI 概念图、占位图、图标设计、wireframe 等场景。',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: '图片描述（支持中文和英文）'
      },
      negativePrompt: {
        type: 'string',
        description: '（可选）不希望出现的元素'
      },
      numberOfImages: {
        type: 'number',
        description: '（可选）生成图片数量，默认 1，最大 4',
        default: 1
      },
      aspectRatio: {
        type: 'string',
        enum: ['1:1', '3:4', '4:3', '9:16', '16:9'],
        description: '（可选）图片宽高比，默认 1:1',
        default: '1:1'
      },
      outputPath: {
        type: 'string',
        description: '（可选）保存图片的文件路径。如不指定则返回 base64'
      },
      style: {
        type: 'string',
        enum: ['photorealistic', 'digital-art', 'sketch', 'watercolor', 'pixel-art'],
        description: '（可选）图片风格'
      }
    },
    required: ['prompt']
  }
}
```

**返回格式**:

```json
{
  "prompt": "...",
  "images": [
    {
      "base64": "iVBORw0KGgo...",
      "mimeType": "image/png",
      "savedPath": "./output/generated-image-1.png"
    }
  ],
  "metadata": {
    "model": "imagen-3.0-generate-002",
    "aspectRatio": "16:9",
    "count": 1
  }
}
```

**实现文件**: `src/tools/generate-image.ts`（新增）

**注意事项**:
- Imagen API 可能需要 Vertex AI 而非 AI Studio key，需要测试确认
- 如果 AI Studio 不支持，可降级为使用 `gemini-3-pro-image-preview` 模型的原生图片生成能力
- 需要处理安全过滤拒绝的情况

---

### 3.3 File API 增强代码库分析

**用户痛点**: 当前 `analyze-codebase` 把所有文件内容拼接到 prompt 中，大项目（>100 文件）容易超出 token 限制或导致响应变慢。

**SDK 接口**:

```typescript
// 上传文件
const file = await ai.files.upload({
  file: '/path/to/large-file.txt',  // Node.js 可直接传路径
  config: {
    mimeType: 'text/plain',
    displayName: 'codebase-snapshot'
  }
});

// 等待文件处理完成
// file.state: PROCESSING → ACTIVE

// 在请求中引用文件
const response = await ai.models.generateContent({
  model: 'gemini-3.1-pro-preview',
  contents: [{
    role: 'user',
    parts: [
      { fileData: { fileUri: file.uri, mimeType: 'text/plain' } },
      { text: '分析这个代码库...' }
    ]
  }]
});
```

**改进方案**:

在 `analyze-codebase` 中添加双模式：

| 模式 | 触发条件 | 行为 |
|------|---------|------|
| **内联模式**（现有） | 文件总 token < 500K | 保持现有的 prompt 内联方式 |
| **File API 模式**（新增） | 文件总 token ≥ 500K | 将代码打包上传为文件，通过 URI 引用 |

```typescript
// 自动选择模式
const totalTokenEstimate = totalChars / 4;  // 粗略估算
if (totalTokenEstimate < 500_000) {
  // 内联模式（现有逻辑）
  contents = [{ role: 'user', parts: [{ text: combinedCode + prompt }] }];
} else {
  // File API 模式
  const file = await ai.files.upload({ file: codeSnapshot, config: { mimeType: 'text/plain' } });
  await waitForFileActive(file);
  contents = [{
    role: 'user',
    parts: [
      { fileData: { fileUri: file.uri, mimeType: 'text/plain' } },
      { text: prompt }
    ]
  }];
}
```

**实现方式**: 修改 `src/tools/analyze-codebase.ts`，新增 `src/utils/file-upload.ts`

---

## 4. 现有工具增强

### 4.1 ThinkingLevel 扩展

**当前**: 只支持 `'low'` 和 `'high'` 两级

**SDK 1.46.0 支持**:

| 级别 | 说明 | 适用场景 |
|------|------|---------|
| ~~`minimal`~~ | ~~最少思考~~ | ⚠️ **实测不支持** gemini-3.1-pro-preview，跳过 |
| `low` | 浅度思考 | 一般搜索、简单分析 |
| `medium` | 中度思考 | 代码审查、中等复杂度任务 |
| `high` | 深度思考 | 架构分析、复杂推理 |

**改动范围**:

```typescript
// 工具定义中的 thinkingLevel enum 扩展
thinkingLevel: {
  type: 'string',
  enum: ['low', 'medium', 'high'],  // 从 2 个扩展到 3 个（minimal 不支持 3.1 Pro）
  default: 'high',
  description: '思考深度：low=快速, medium=平衡, high=深度分析'
}
```

**影响的工具**:
- `gemini_search` — 添加 `minimal` 和 `medium` 选项
- `gemini_analyze_codebase` — 添加 `minimal` 和 `medium` 选项
- `gemini_code_execution`（新工具）— 默认 `medium`

### 4.2 ThinkingBudget 高级控制

**新增可选参数**: 允许高级用户精确控制思考 token 预算

```typescript
thinkingBudget: {
  type: 'number',
  description: '（可选，高级）思考 token 预算。0=禁用思考，-1=自动。优先于 thinkingLevel'
}
```

**实现逻辑**:
```typescript
const thinkingConfig: any = {};
if (params.thinkingBudget !== undefined) {
  thinkingConfig.thinkingBudget = params.thinkingBudget;
} else {
  thinkingConfig.thinkingLevel = params.thinkingLevel || 'high';
}
```

---

## 5. 工具定义更新（definitions.ts）

### 5.1 更新后的工具列表

| # | 工具名称 | 状态 | 说明 |
|---|---------|------|------|
| 1 | `gemini_search` | 🔄 增强 | ThinkingLevel 4 级 |
| 2 | `gemini_analyze_content` | 保持 | 无变化 |
| 3 | `gemini_analyze_codebase` | 🔄 增强 | File API 模式 + ThinkingLevel 4 级 |
| 4 | `gemini_multimodal_query` | 保持 | 无变化 |
| 5 | `gemini_brainstorm` | 保持 | 无变化 |
| 6 | `gemini_code_execution` | 🆕 新增 | Python 代码执行 |
| 7 | `gemini_generate_image` | 🆕 新增 | Imagen 图片生成 |

### 5.2 模型枚举更新

```typescript
// 当前
enum: ['gemini-3.1-pro-preview', 'gemini-3-pro-preview', 'gemini-3-flash-preview', 'gemini-2.5-pro']

// v2.0.0 更新
enum: [
  'gemini-3.1-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  // 图片生成专用模型（如适用）
  'imagen-4.0-generate-001',
]
```

---

## 6. 文件变更清单

| # | 文件 | 变更类型 | 说明 |
|---|------|----------|------|
| 1 | `src/tools/code-execution.ts` | **新增** | 代码执行工具实现 |
| 2 | `src/tools/generate-image.ts` | **新增** | 图片生成工具实现 |
| 3 | `src/utils/file-upload.ts` | **新增** | File API 上传/等待/清理逻辑 |
| 4 | `src/tools/definitions.ts` | 修改 | 新增 2 个工具定义，ThinkingLevel 扩展 |
| 5 | `src/tools/search.ts` | 修改 | ThinkingLevel 4 级 |
| 6 | `src/tools/analyze-codebase.ts` | 修改 | File API 模式 + ThinkingLevel 4 级 |
| 7 | `src/config/models.ts` | 修改 | 新增 Imagen 模型配置（如需要） |
| 8 | `src/server.ts` | 修改 | 注册新工具 |
| 9 | `package.json` | 修改 | 版本号 → `2.0.0` |
| 10 | `README.md` | 修改 | 新工具文档 |
| 11 | `CHANGELOG.md` | 修改 | v2.0.0 条目 |

**预计变更量**: ~11 个文件，约 500-700 行新代码

---

## 7. 实施计划

### Phase 1: 代码执行工具（2-3 小时）

1. 实现 `src/tools/code-execution.ts`
2. 在 `definitions.ts` 注册
3. 在 `server.ts` 注册
4. 测试：数学计算、数据分析、正则验证

### Phase 2: 图片生成工具（2-3 小时）

1. 测试 AI Studio key 是否支持 Imagen API（关键风险点）
2. 如支持：实现 `src/tools/generate-image.ts`
3. 如不支持：改用 `gemini-3-pro-image-preview` 的原生图片生成
4. 测试：UI 概念图、图标、wireframe

### Phase 3: File API + ThinkingLevel（1-2 小时）

1. 实现 `src/utils/file-upload.ts`
2. 修改 `analyze-codebase.ts` 支持双模式
3. 扩展 ThinkingLevel 到 4 级
4. 测试：大项目代码库分析

### Phase 4: 文档与发布（1 小时）

1. 更新 README.md
2. 更新 CHANGELOG.md
3. 编译、测试、发布

---

## 8. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| ~~AI Studio key 不支持 Imagen API~~ | ~~中~~ | ~~高~~ | ✅ **已实测确认：AI Studio key 支持 Imagen 4，风险消除** |
| **代码执行安全性** | 低 | 中 | Gemini 在沙箱中执行，用户无法直接控制执行环境 |
| **File API 文件过期** | 低 | 低 | 文件有 TTL，分析完立即清理 |
| **Token 费用增加** | 中 | 低 | code_execution 和 generateImages 有独立计费，在文档中说明 |

---

## 9. 不在本版本范围内

| 能力 | 原因 |
|------|------|
| Live API | MCP 不支持持久连接 |
| Interactions API | 有状态会话与 MCP 设计冲突 |
| Veo 视频生成 | 场景太 niche |
| Google Maps | 与项目定位不符 |
| Chats API | MCP 每次调用独立，无需会话管理 |
| Caches API | 优化方向，但需要大量使用数据才能评估 ROI |

---

## 10. 成功指标

| 指标 | 目标 |
|------|------|
| 工具数量 | 5 → 7（+40%） |
| 代码执行成功率 | > 90% |
| 图片生成可用率 | > 85%（考虑安全过滤拒绝） |
| 大项目分析支持 | 从 ~100 文件提升到 ~500 文件 |
| ThinkingLevel 选项 | 2 → 3（+50%） |
