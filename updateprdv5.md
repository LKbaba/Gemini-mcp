# updatePRD v5 — v2.1.0 Model Update: Add Gemini 3.5 Flash GA

**Version**: v2.1.0
**Date**: 2026-07-09
**Type**: Model Configuration Update

---

## 1. Summary

Add `gemini-3.5-flash` (GA, released 2026-05-19) as a first-class supported model, deprecate `gemini-3-flash-preview` and `gemini-2.5-pro`, and update search tool default from `gemini-3-flash-preview` to `gemini-3.5-flash`.

---

## 2. Changes

### 2.1 New Model: gemini-3.5-flash

| Field | Value |
|-------|-------|
| ID | `gemini-3.5-flash` |
| Status | **GA/Stable** (released 2026-05-19) |
| Context Window | 1M tokens |
| Max Output | 65,536 tokens |
| Pricing | $1.50 / 1M input tokens, $9.00 / 1M output tokens |
| Capabilities | vision, function calling, streaming, thinking, system instructions |
| Best For | Quick Q&A, real-time analysis, batch processing, cost optimization, fallback |

### 2.2 Deprecated Model Mappings (updated)

| Deprecated Model | Maps To | Reason |
|-----------------|---------|--------|
| `gemini-3-pro-preview` | `gemini-3.1-pro-preview` | Shut down 2026-03-09 (existing) |
| `gemini-3-flash-preview` | `gemini-3.5-flash` | **NEW**: No shutdown date yet, but GA replacement available |
| `gemini-2.5-pro` | `gemini-3.5-flash` | **NEW**: Deprecated, shutdown 2026-10-16 |

### 2.3 Default Model Changes

| Tool | Before (v2.0.0) | After (v2.1.0) |
|------|-----------------|----------------|
| gemini_search | `gemini-3-flash-preview` | `gemini-3.5-flash` |
| Other 4 tools | `gemini-3.1-pro-preview` | `gemini-3.1-pro-preview` (unchanged) |

### 2.4 Model Recommendations (updated)

| Use Case | Before | After |
|----------|--------|-------|
| codebase_analysis | `gemini-2.5-pro` | `gemini-3.1-pro-preview` |
| batch_processing | `gemini-3-flash-preview` | `gemini-3.5-flash` |
| quick_tasks | `gemini-3-flash-preview` | `gemini-3.5-flash` |
| fallback | `gemini-2.5-pro` | `gemini-3.5-flash` |

### 2.5 Model Enum (all tools)

Before: `['gemini-3.1-pro-preview', 'gemini-3-pro-preview', 'gemini-3-flash-preview']`
After: `['gemini-3.1-pro-preview', 'gemini-3.5-flash', 'gemini-3-pro-preview', 'gemini-3-flash-preview']`

### 2.6 Pricing Update

| Model | Input / 1M tokens | Output / 1M tokens | Source |
|-------|-------------------|---------------------|--------|
| gemini-3.1-pro-preview | ~$2.00 (≤200k) / ~$4.00 (>200k) | ~$12.00 (≤200k) / ~$18.00 (>200k) | ai.google.dev/gemini-api/docs/pricing |
| gemini-3.5-flash | $1.50 | $9.00 | ai.google.dev/gemini-api/docs/pricing |

> Note: Pricing varies by context length, modality, and platform (AI Studio vs Vertex AI). Verify at https://ai.google.dev/gemini-api/docs/pricing

---

## 3. Files to Modify

### Source Files (src/)
| File | Changes |
|------|---------|
| `src/config/models.ts` | Add gemini-3.5-flash config with pricing; update file header to v2.1.0; fix lastUpdate to 'May 2026'; fix 2.5-pro deprecation comment (shutdown 2026-10-16); convert Chinese comments to English |
| `src/tools/definitions.ts` | Add gemini-3.5-flash to enum; update search default description; version comments v2.1.0; English comments |
| `src/tools/search.ts` | Default model → gemini-3.5-flash; update SupportedModel type; version comments v2.1.0; English comments |
| `src/utils/validators.ts` | Update model list in docs and error message; version comments v2.1.0; English comments |
| `src/tools/analyze-codebase.ts` | Add gemini-3.5-flash to SupportedModel type; version comments v2.1.0; English comments |
| `src/tools/analyze-content.ts` | Same as above |
| `src/tools/brainstorm.ts` | Same as above |
| `src/tools/multimodal-query.ts` | Same as above |

### Config/Docs Files
| File | Changes |
|------|---------|
| `CLAUDE.md` | Update Models line: search default → gemini-3.5-flash |
| `PRD.md` | Update §2.1 tool table, §4.1 model table, §4.2 deprecation mappings, §4.3 selection guide, §2.x model enums, §7 version history |
| `package.json` | version → "2.1.0" |

### Cleanup
| Action | Details |
|--------|---------|
| Restore 7 dist files | `constants.js`, `server.js`, `types.js`, `error-handler.js`, `errors.js`, `gemini-client.js`, `gemini-factory.js` — line-ending-only diffs, no real changes |
| Rebuild dist/ | `npx tsc` after source edits |

---

## 4. Current Model Landscape (July 2026)

| Model | Status | Shutdown Date | Notes |
|-------|--------|---------------|-------|
| gemini-3.5-flash | GA | — | Flagship Flash, recommended for most production use |
| gemini-3.1-pro-preview | Preview | — | Best reasoning/agentic model |
| gemini-3.1-flash-lite | GA | — | Cost-efficient, high-volume (not yet added to this server) |
| gemini-3-flash-preview | Preview | Not announced | Recommend migration to 3.5-flash |
| gemini-3-pro-preview | Shut down | 2026-03-09 | Auto-mapped to 3.1-pro-preview |
| gemini-2.5-pro | Deprecated | 2026-10-16 | Auto-mapped to 3.5-flash |

Source: https://ai.google.dev/gemini-api/docs/deprecations (searched 2026-07-09)
