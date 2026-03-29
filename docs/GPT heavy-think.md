## 结论

只要你的场景里出现了 **MCP server、agent 工具调用、OpenClaw、memory consolidation、多人协作或生产流量**，我建议把 **AI Studio key 视为原型期/过渡期凭证**，生产上优先切到 **Vertex AI + Cloud Run + service account / ADC**。Google 官方仍把 Gemini Developer API 定位成“上手最快”的路径，但 Vertex AI 才提供更完整的 IAM、审计、网络隔离和企业治理能力；而且对需要主体身份的 Google Cloud MCP server，标准 API key 本身就不是通用认证方案。([Google AI for Developers][1])

## 2026 年 2–3 月最重要的变化

1. **2026-03-17 起，远程 MCP endpoint 默认随着受支持产品 API 一起启用。** 旧的 `gcp.managed.allowedMCPServices` 组织策略控制已在 **2026-02-17 弃用**、**2026-03-17 停用**；现在要改用 **IAM deny policies** 控制谁能调 MCP 工具。([Google Cloud Documentation][2])

2. **Google 在 2026-03 更新了 Cloud Run 托管 MCP 的官方路径。** 现在官方文档明确给了本地客户端、Cloud Run 客户端、sidecar、service-to-service、Cloud Service Mesh 等认证方式；也同步补齐了 AI security、Model Armor、计费控制和 IAM deny 的说明。([Google Cloud Documentation][3])

---

## 1) Google 官方当前对 Gemini API key 的安全要求

* **把 Gemini API key 当密码处理。** 官方明确说，key 泄露后，别人可以消耗你的配额、产生费用，并访问你的私有数据（例如文件）。([Google AI for Developers][4])

* **不要把 key 提交到代码仓库，也不要在生产环境直接放到前端 / Web / 移动端。** 官方把“前端直连长期 key”定性为不安全，最安全的方式仍然是 **server-side 调 Gemini API**。([Google AI for Developers][4])

* **Live API 例外：前端直连时应用 ephemeral tokens，而不是长期 API key。** 官方给出的方向是：后端签发短时 token，客户端只拿 ephemeral token 连接 Live API；默认是 **1 分钟内可发起新会话**、**30 分钟会话有效**。([Google AI for Developers][4])

* **限制 key 的用途。** Gemini key 官方要求尽量加 **IP / HTTP referrer / Android / iOS app 限制**，并且只启用必要 API；在 AI Studio 里只会显示“无限制”或“只限制到 Generative Language API”的 key，真正的限制编辑入口在 Cloud Console。([Google AI for Developers][4])

* **传 key 时不要走 URL query 参数。** Gemini 官方 REST 示例和 Google Cloud API key 最佳实践都要求优先使用 `x-goog-api-key` header 或 client library。([Google AI for Developers][4])

* **定期审计、轮换、删除无用 key，并做 key 隔离。** Google Cloud 文档明确建议：每个应用/成员单独 key、删除不用的 key、周期性轮换。([Google AI for Developers][4])

* **不要走“API key 绑定 service account”的生产折中方案。** Google Cloud 文档直接说，生产应迁移到 **IAM + 短期凭证 / ADC**。([Google Cloud Documentation][5])

* **环境变量优先级要小心。** 官方说明 `GOOGLE_API_KEY` 和 `GEMINI_API_KEY` 同时存在时，`GOOGLE_API_KEY` 优先。混用 OpenClaw / gemini-cli / 其他 wrapper 时，这个优先级非常容易制造“我明明换了 key 却还在用旧 key”的错觉。([Google AI for Developers][4])

---

## 2) MCP / agent 场景下怎么安全使用 Gemini

### 推荐原则

* **能不用 key 就不用 key。** 对需要 IAM 主体身份的 Google Cloud MCP servers，官方说明 **标准 API key 不支持**；生产环境推荐为 AI 应用创建 **service account / agent identity / OAuth client**。([Google Cloud Documentation][6])

* **自己的 MCP server 优先托管在 Cloud Run。** 官方 2026-03 文档明确支持 **HTTP/streamable HTTP** 的 MCP server 托管在 Cloud Run；不支持 stdio 型 server 直接托管。([Google Cloud Documentation][3])

* **本地开发连远程 MCP：用 Cloud Run proxy 或 OIDC ID token。** 官方给出的本地安全方式是 `roles/run.invoker` + `gcloud run services proxy`，或者自己注入 OIDC ID token。([Google Cloud Documentation][3])

* **Cloud Run 上的 agent 连 MCP：首选 sidecar，其次 service-to-service。** 官方说 sidecar 部署时 client/server 在同一实例内，直接走 `localhost`，不需要额外认证；如果拆成独立服务，再用 service-to-service auth 或 Cloud Service Mesh。([Google Cloud Documentation][3])

* **写操作尽量保留 Human-in-the-Middle。** Google 的 MCP 安全文档把 Agent-Only 明确列为更容易受到 prompt injection、tool chaining、错误处理失控影响的模式；这意味着读写分离是默认安全基线：**读工具可以更自动化，写工具尽量要审批**。([Google Cloud Documentation][7])

### 2026 年的 MCP 安全基线

* **默认只给必要 agent 授 `roles/mcp.toolUser`。** 这个角色核心权限就是 `mcp.tools.call`。([Google Cloud Documentation][8])

* **再叠加 IAM deny policy，把“非只读工具”默认挡住。** Google 官方现在就是这么建议的，而且 deny condition 已支持按 `tool.isReadOnly` 和 `auth.oauthClientId` 做控制。([Google Cloud Documentation][9])

* **把 agent 的提示词和外部数据隔离开。** 官方明确写了：把用户输入和数据库内容视为“数据”，不要与 system prompt 混在同一指令上下文；并要隔离不同用户/租户/agent 的 memory/state。([Google Cloud Documentation][7])

* **对 memory / consolidation 数据做加密与脱敏。** Google 在 MCP 安全文档里专门写了：agent memory 里的敏感数据要加密；并给了 de-identification template 的做法。([Google Cloud Documentation][7])

* **启用 Model Armor。** 官方说明 Model Armor 可以在 MCP tool call 和 tool response 两侧拦截 prompt injection、敏感信息泄露和 tool poisoning。([Google Cloud Documentation][10])

---

## 3) 避免 “hijacking / leaked credentials” 封禁的最有效方法

### 真正有效的组合，不是单点技巧

1. **从根上消掉“长期 key 进入客户端/本地工具配置”的路径。** 长期 key 只放服务端；前端直连只给 Live API 的 ephemeral token。([Google AI for Developers][4])

2. **按“应用 / 环境 / 高风险 agent”拆项目，而不是只多发几把 key。** 因为 Gemini rate limits 是 **按 project 而不是按 key** 生效；Google 也建议把应用和环境拆到不同项目中以隔离 IAM 和 quota。换句话说，**多 key 不是强隔离，分项目才更像真正的 blast-radius 控制**。([Google AI for Developers][11])

3. **每个组件独立凭证。** 至少把 **主推理、embeddings/memory、CLI/本地调试、staging、production** 分开，不要共用一把 key。Google Cloud 的 API key best practices 本身就要求 key isolation。([Google Cloud Documentation][5])

4. **限制 API + 限制来源。** 对 AI Studio key，至少限制到 **Generative Language API**，再结合固定来源时的 **IP 限制**；Web/移动端才考虑 referrer / app 限制。([Google AI for Developers][4])

5. **轮换要能“杀死旧路径”。** 只改 shell/env 不够；必须确认 wrapper 实际从哪里取 key，并清理旧 key。Google 官方要求 नियमित轮换；OpenClaw 近期案例也说明，旧 key 可能卡在 profile 文件里继续被用。([Google Cloud Documentation][5])

6. **加三层费用防线：billing tier cap、budget/alerts、API quota caps。** Gemini billing 文档现在给了 **billing-account 级别的 tier caps**；Cloud Billing 最佳实践推荐 **budgets + alerts + 自动化 cost-control responses**；Cloud APIs 还能配 **daily / per-minute / per-user caps**。但官方也明确说 **quota 不是绝对精确的，会有执行延迟，要预留 buffer**。([Google AI for Developers][12])

7. **打开你真正会用到的审计。** 对 Google Cloud MCP，Data Access audit logs **默认不开**，需要手动启用；如果你真的在意“事后溯源是哪台 client / 哪个 tool / 哪个 principal 调了什么”，这一步很重要。([Google Cloud Documentation][13])

8. **生产上一定保留“直连官方 SDK / REST”的探针。** 最近很多“像是 key 泄露 / 模型不可用 / Vertex 认证失效”的问题，最终是 wrapper bug，而不是 Google 后端。([GitHub][14])

---

## 4) AI Studio key vs Vertex AI：实际区别与迁移步骤

### 实际区别

* **AI Studio / Gemini Developer API**：上手快，API key 即可；官方说大多数开发者会先从这里开始。但这条线本质仍是 **key-based**，更适合原型、单后端、低治理要求场景。([Google AI for Developers][1])

* **Vertex AI**：生产推荐用 **ADC / service account**，并且可以配 IAM 角色、自定义权限、Audit logs、VPC Service Controls、Private Service Connect 等企业控制。([Google Cloud Documentation][15])

* **数据治理差异**：Gemini Developer API 的 **Free tier** 内容可用于改进产品，**Paid tier** 不用于改进产品；Vertex AI 这边官方写得更明确：**未经你的许可或指令，Google 不会用你的数据训练或微调模型**。([Google AI for Developers][16])

* **MCP 适配差异**：需要 IAM 主体的 Google Cloud MCP servers 不接受标准 API key，所以只靠 AI Studio key 并不能完整覆盖 MCP / agent 工具链。([Google Cloud Documentation][6])

* **安全/网络能力差异**：Vertex AI 能叠加 VPC-SC 和 PSC；但官方也提醒，**preview models 不支持 security controls**。这意味着你如果在生产里大量用 preview model，风险边界会比 GA 模型更差。([Google Cloud Documentation][17])

### 迁移步骤

1. **先换 SDK，不要先大改业务代码。** Google Gen AI SDK 是统一接口；同一套代码在 Gemini Developer API 和 Vertex AI 上大多都能跑，只是 client 初始化不同。旧 Vertex generative module 已弃用，并将在 **2026-06-24** 后移除。([Google Cloud Documentation][18])

2. **把认证从 API key 切到 service account / ADC。** Vertex 官方建议：**测试可用 API key，生产用 ADC**。([Google Cloud Documentation][15])

3. **选项目和区域。** 可以沿用原 Google Cloud project，也可以新建；但要注意 **Vertex 支持区域和 Gemini Developer API 不一定一致**。([Google AI for Developers][1])

4. **迁移 prompts / tuning 资产。** AI Studio 的 prompt 数据在 Google Drive `AI_Studio` 文件夹里；下载后要从 `.txt` 改成 `.json` 再导入 Vertex AI Studio。AI Studio 创建过的模型要在 Vertex 里 **重新训练**。训练数据要先上 Cloud Storage。([Google Cloud Documentation][19])

5. **重建治理层。** 包括 IAM、Budget、Quota、Secret Manager、VPC-SC/PSC、Audit logs。([Google Cloud Documentation][20])

6. **删掉不再用的旧 key。** Google 官方迁移文档专门把 “Delete unused API keys” 单列出来。([Google Cloud Documentation][19])

---

## 5) 开发者真实踩坑案例（2026 年近期）

下面这些是 **真实 forum / GitHub issue**，不是官方 RCA，但都非常有参考价值。([Google AI Developers Forum][21])

1. **2026-03-24：项目因疑似 API key hijacking 被暂停。** 论坛案例显示在 **3 月 21–23 日** 出现异常调用和费用飙升，调用集中在 Gemini 图像生成和 Places API，开发者事后急需 source IP / region / header 级别线索。这个案例直接说明：**没有预算、异常监控、日志和隔离项目时，事后取证会很被动**。([Google AI Developers Forum][21])

2. **2026-03-26：OpenClaw 的 `memory_search` 在 Gemini key 被 Google 标记为 leaked 后静默失效。** 错误是 403 `Your API key was reported as leaked`，但更坑的是，真正生效的 key 不在环境变量，而在 `~/.openclaw/agents/main/agent/auth-profiles.json`；只改 `.bashrc` 不会生效，还要重启 gateway。([GitHub][22])

3. **2026-03：OpenClaw 本地 memory provider 被忽略。** 即使配置了 `memorySearch.provider: "local"` 和 `fallback: "none"`，`memory_search` 还是返回 `provider: "gemini"`、`model: "gemini-embedding-001"`。这对 memory consolidation 场景很危险，因为你以为数据留本地，实际却可能仍然打到 Gemini embeddings。([GitHub][23])

4. **2026-03-13：OpenClaw 的 `google-vertex` 认证回归。** 社区报告显示同一份 service-account JSON / ADC 能直接调用官方 Vertex REST，但 OpenClaw 路径失败，表现得像认证/模型权限问题。结论很明确：**先用官方 SDK/REST 验证，再判断是不是 Google 侧故障。** ([GitHub][14])

5. **2026-03-08：OpenClaw 的 provider/model 前缀回归。** 它把 `google/gemini-2.5-pro` 整个当作 model ID 发给 Google，返回 404。看起来像模型权限或 API 版本问题，本质其实是 wrapper 解析 bug。([GitHub][24])

6. **2026-03-12：gemini-cli + MCP 在非 yolo 模式下出现 `malformed function call` / 400。** 这说明 **HITL/确认流程本身也可能和工具调用链冲突**，所以生产上要把“可审批”和“可稳定执行”分开测试。([GitHub][25])

7. **2026-03-02：Gemini + MCP 工具 schema 的 `$ref` 问题。** LobeHub 记录到 Gemini provider 在 MCP tool schema 含 `$ref` 时会返回 `400 INVALID_ARGUMENT`。这提醒你：**对接 MCP 时要做 schema flatten / normalize**，别假设所有 JSON Schema 语法都能直接被 Gemini function-calling 接受。([GitHub][26])

---

## 6) 目前最推荐的完整安全架构（含代码 / 配置示例）

### A. 生产推荐：**Vertex AI + Cloud Run + service account / ADC**

**架构：**
Client / IDE / OpenClaw → 你自己的后端或 Cloud Run agent → Vertex AI
同时，工具调用走 Cloud Run 托管的 MCP server，默认只开放只读工具；写工具要审批或单独授予。Secret 用 Secret Manager，日志走 Cloud Logging / Audit Logs，费用用 budgets + quota caps。([Google Cloud Documentation][3])

```python
from google import genai

# Cloud Run 上直接挂 user-managed service account，生产不要手工塞 GOOGLE_APPLICATION_CREDENTIALS
client = genai.Client(
    vertexai=True,
    project="YOUR_PROJECT",
    location="us-central1",
)

resp = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="ping"
)

print(resp.text)
```

这个初始化方式来自 Google 的统一 Gen AI SDK / Vertex 迁移文档；而在 Cloud Run 上，官方明确建议用 **service identity**，不要把 `GOOGLE_APPLICATION_CREDENTIALS` 作为环境变量塞进去。([Google AI for Developers][1])

### B. 本地开发连 Cloud Run MCP：**Cloud Run proxy**

```bash
gcloud run services proxy MCP_SERVER_NAME --region REGION --port=3000
```

```json
{
  "mcpServers": {
    "cloud-run": {
      "url": "http://localhost:3000/sse"
    }
  }
}
```

如果你的 MCP client 不支持 `url`，官方给了 `mcp-remote` 兜底；如果 agent 也跑在 Cloud Run 上，官方更推荐 **sidecar** 或 **service-to-service auth**。([Google Cloud Documentation][3])

### C. MCP 默认拒绝写操作：**IAM deny policy**

```json
{
  "rules": [
    {
      "denyRule": {
        "deniedPrincipals": [
          "principalSet://goog/public:all"
        ],
        "deniedPermissions": [
          "mcp.googleapis.com/tools.call"
        ],
        "denialCondition": {
          "title": "Deny read-write tools",
          "expression": "api.getAttribute('mcp.googleapis.com/tool.isReadOnly', false) == false"
        }
      }
    }
  ]
}
```

这是 Google 官方给的 deny read-write tools 样例。做法上建议：**先全局 deny 非只读工具，再给特定 agent/项目按需放行**。([Google Cloud Documentation][9])

### D. 如果你暂时必须继续用 AI Studio key：最低可接受方案

```python
from google.cloud import secretmanager
from google import genai

def read_secret(secret_version: str) -> str:
    client = secretmanager.SecretManagerServiceClient()
    resp = client.access_secret_version(request={"name": secret_version})
    return resp.payload.data.decode("utf-8")

api_key = read_secret(
    "projects/YOUR_PROJECT/secrets/GEMINI_API_KEY/versions/3"
)

client = genai.Client(api_key=api_key)
resp = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="ping"
)
print(resp.text)
```

这套最小基线要同时满足：

* key 不进前端，不进 Git，不进共享配置；
* Secret 放 Secret Manager，运行时直接取；
* key 只限制到 Generative Language API，并在可行时加 IP/app/referrer 限制；
* 主推理、embeddings/memory、CLI、staging、prod 分开 key；
* 预算告警、API cap、旧 key 删除和轮换全做。Google 的 Secret Manager 最佳实践还特别提醒：**尽量不要通过文件系统或环境变量传 secret**；Cloud Run 也不建议把 secret 当普通 env var。([Google Cloud Documentation][27])

---

## 官方链接（按用途）

* API key 官方要求与 Gemini key 使用方式：([Google AI for Developers][4])
* Google Cloud API key 安全最佳实践：([Google Cloud Documentation][5])
* Live API ephemeral tokens：([Google AI for Developers][28])
* Cloud Run 托管 MCP server：([Google Cloud Documentation][3])
* Google Cloud MCP 总览 / 认证 / IAM / Model Armor：([Google Cloud Documentation][10])
* `gcp.managed.allowedMCPServices` 弃用与 IAM deny 替代：([Google Cloud Documentation][2])
* AI Studio → Vertex AI 迁移：([Google Cloud Documentation][19])
* Vertex AI 生产认证 / 访问控制：([Google Cloud Documentation][15])
* Vertex AI 安全控制 / VPC-SC / PSC：([Google Cloud Documentation][17])
* Secret Manager 最佳实践：([Google Cloud Documentation][27])
* 预算、告警、API cap、MCP 审计日志：([Google Cloud Documentation][29])

[1]: https://ai.google.dev/gemini-api/docs/migrate-to-cloud "https://ai.google.dev/gemini-api/docs/migrate-to-cloud"
[2]: https://docs.cloud.google.com/mcp/organization-control-mcp-servers-deprecation "Organization policy control of MCP servers deprecation  |  Google Cloud MCP servers  |  Google Cloud Documentation"
[3]: https://docs.cloud.google.com/run/docs/host-mcp-servers "https://docs.cloud.google.com/run/docs/host-mcp-servers"
[4]: https://ai.google.dev/gemini-api/docs/api-key "https://ai.google.dev/gemini-api/docs/api-key"
[5]: https://docs.cloud.google.com/docs/authentication/api-keys-best-practices "https://docs.cloud.google.com/docs/authentication/api-keys-best-practices"
[6]: https://docs.cloud.google.com/mcp/authenticate-mcp?utm_source=chatgpt.com "Authenticate to Google and Google Cloud MCP servers"
[7]: https://docs.cloud.google.com/mcp/ai-security-safety "https://docs.cloud.google.com/mcp/ai-security-safety"
[8]: https://docs.cloud.google.com/iam/docs/roles-permissions/mcp "Google Cloud MCP servers roles and permissions  |  Identity and Access Management (IAM)  |  Google Cloud Documentation"
[9]: https://docs.cloud.google.com/mcp/control-mcp-use-iam "https://docs.cloud.google.com/mcp/control-mcp-use-iam"
[10]: https://docs.cloud.google.com/mcp/overview "Google Cloud MCP servers overview  |  Google Cloud Documentation"
[11]: https://ai.google.dev/gemini-api/docs/rate-limits?utm_source=chatgpt.com "Rate limits | Gemini API - Google AI for Developers"
[12]: https://ai.google.dev/gemini-api/docs/billing?utm_source=chatgpt.com "Billing | Gemini API - Google AI for Developers"
[13]: https://docs.cloud.google.com/mcp/audit-logging?utm_source=chatgpt.com "Google Cloud MCP servers audit logging"
[14]: https://github.com/openclaw/openclaw/issues/48479 "[Bug]: google-vertex on 2026.3.13 appears to use API-key auth instead of ADC/Bearer for Gemini 3.x (global) · Issue #48479 · openclaw/openclaw · GitHub"
[15]: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/gcp-auth "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/gcp-auth"
[16]: https://ai.google.dev/gemini-api/docs/pricing "https://ai.google.dev/gemini-api/docs/pricing"
[17]: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/security-controls "Security controls for Generative AI  |  Generative AI on Vertex AI  |  Google Cloud Documentation"
[18]: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/sdks/overview "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/sdks/overview"
[19]: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/migrate/migrate-google-ai "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/migrate/migrate-google-ai"
[20]: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/access-control "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/access-control"
[21]: https://discuss.ai.google.dev/t/suspended-project-with-suspected-api-key-abuse-need-access-to-detailed-gemini-api-logs/135781 "Suspended Project with Suspected API Key Abuse – Need Access to Detailed Gemini API Logs - Gemini API - Google AI Developers Forum"
[22]: https://github.com/openclaw/openclaw/issues/54912 "memory_search silently fails with leaked API key — no actionable recovery guidance · Issue #54912 · openclaw/openclaw · GitHub"
[23]: https://github.com/openclaw/openclaw/issues/29493/linked_closing_reference?reference_location=REPO_ISSUES_INDEX "Bug: memory_search tool uses Gemini instead of local despite provider=local (CLI works correctly) · Issue #29318 · openclaw/openclaw · GitHub"
[24]: https://github.com/openclaw/openclaw/issues/41398/linked_closing_reference?reference_location=REPO_ISSUES_INDEX "[Bug]: Google model provider prefix not stripped in 2026.3.8 — causes 404 on all Google model API calls (regression) · Issue #41249 · openclaw/openclaw · GitHub"
[25]: https://github.com/google-gemini/gemini-cli/issues/22179 "[Bug] MCP Integration fails with API validation error (400) and \"malformed function call\" unless Yolo mode is enabled · Issue #22179 · google-gemini/gemini-cli · GitHub"
[26]: https://github.com/lobehub/lobehub/issues/12602 "Google Gemini models fail with 400 error when MCP tools use JSON Schema $ref · Issue #12602 · lobehub/lobehub · GitHub"
[27]: https://docs.cloud.google.com/secret-manager/docs/best-practices "Secret Manager best practices  |  Google Cloud Documentation"
[28]: https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens?utm_source=chatgpt.com "Ephemeral tokens | Gemini API | Google AI for Developers"
[29]: https://docs.cloud.google.com/docs/security/security-best-practices-genai/billing-controls "https://docs.cloud.google.com/docs/security/security-best-practices-genai/billing-controls"
