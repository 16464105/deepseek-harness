---
description: "Tencent internal CodeBuddy adapter for the Harness LLM seam: the fixed tencent-internal route and package-owned model catalog."
kind: "package-reference"
---

# `@deepseek-ai/dsh-llm-tencent-codebuddy`

English | [中文](README.zh.md)

## Summary

Tencent internal CodeBuddy adapter for the Harness LLM seam. The package exposes one fixed route, `tencent-internal`, backed by pi-ai's OpenAI Chat Completions transport, a package-owned fixed model catalog, and the request normalization used by that integration. Deployment configuration contains a credential reference, an optional model-catalog override, timeouts, and retry policy; callers cannot redirect the trusted key to another endpoint through settings.

The package root exposes the Cordis plugin contract, the fixed provider/default-model/credential constants, the fixed catalog, and the request-header and payload-normalization helpers used by focused protocol tests.

## Table of Contents

- [Fixed provider facts](#fixed-provider-facts)
- [Model catalog](#model-catalog)
- [Config](#config)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

## Fixed provider facts

| Fact | Value |
|---|---|
| Provider route | `tencent-internal` |
| Display name | `Tencent CodeBuddy` |
| Endpoint | `https://copilot.tencent.com/v2` |
| Protocol | OpenAI Chat Completions |
| Default model | `gpt-5.6-sol` |
| Model catalog | package-owned fixed catalog of the 29 desktop chat models (`craft`/`ask`/`plan` union captured from a desktop-client cache) |
| Context window | per-model catalog metadata |
| Default output cap | per-model catalog metadata |
| Input | text, plus image where the catalog declares it |
| Reasoning efforts | `low`, `medium`, `high`, `xhigh`, `max` on reasoning-capable models |
| Default credential reference | `TENCENT_CODEBUDDY_API_KEY` |

## Model catalog

The package owns the catalog. The Tencent endpoint does not expose an OpenAI-compatible `/models` listing, so the catalog is the fixed set of models the internal gateway serves, projected once from a captured desktop-client cache into `src/catalog.ts`: the ordered union of the `craft`, `ask`, and `plan` desktop chat modes, with each model's display name, context window, output cap, image support, and reasoning capability. The catalog is shipped, not discovered at runtime.

A configured `models` list replaces the fixed catalog wholesale — the same contract the direct DeepSeek adapter keeps for its advisory catalog — which is how the Models page edits the directory. An omitted list serves the fixed catalog; an explicit empty list clears it. Duplicate ids are refused where they are written.

## Config

```yaml
- id: llm-tencent-codebuddy
  name: '@deepseek-ai/dsh-llm-tencent-codebuddy'
  config:
    apiKeyEnv: TENCENT_CODEBUDDY_API_KEY
    models:                          # optional; omission serves the fixed catalog
      - id: gateway-new-model
        name: Gateway New Model
        contextWindow: 262144        # optional; route defaults apply when omitted
    timeoutMs: 300000                 # optional provider SDK timeout
    streamIdleTimeoutMs: 300000       # optional; five-minute default
    retryPolicy:                      # optional; omission uses normal defaults
      mode: normal
```

`apiKeyEnv` is a credential reference, never a literal key. Each request resolves it through `ctx.credentials`, falling back to the captured launch environment when the credential service is absent, trims and validates it as a header-safe key, and fails with `MISSING_CREDENTIAL` or `INVALID_CREDENTIAL` without exposing secret content. The plugin registers the `llm-tencent-codebuddy` settings namespace and configurable-provider directory entry, so the Models page stores the key and the model directory without changing the fixed endpoint or protocol. Model-list, timeout, and retry changes apply through the normal settings lifecycle; a changed retry policy replaces the route registration in place.

## CodeBuddy request adaptation

Every request carries the CodeBuddy CLI route and IDE headers, the fixed CLI `User-Agent`, a Session-stable conversation id, and fresh request/message ids. A non-header-safe Session id is represented by a deterministic SHA-256 prefix rather than copied into a header.

Before transport, the adapter merges `system` and `developer` messages into one leading system message; supplies a neutral system message when none exists; inserts a user `Hello` when the first conversation message is not from a user; removes `cache_control` recursively; requires streaming and usage; maps `max_completion_tokens` to `max_tokens`; enforces CodeBuddy's 100-token minimum output value; and normalizes Tencent tool-choice forms. Tencent evaluates image input only from its current user message, while Harness can append workspace context as a second adjacent user message. The adapter therefore merges an adjacent user-message run only when that run contains an image, preserving content-part order; text-only runs and user messages separated by assistant or tool history remain distinct. A named tool choice narrows to exactly one matching declaration and fails before network I/O when absent or ambiguous.

Transport and stream conversion remain owned by [`dsh-llm-pi-ai`](../llm-pi-ai/README.md). Its public `resolveProfiles` and `prepareRequest` hooks let this package reuse credential, attachment, replay, timeout, and streaming behavior while retaining provider facts and protocol normalization here.

-----

<a id="dev-note"></a>
## Dev Note

The adapter is desktop-deployment-specific: the Tencent CodeBuddy endpoint and normalization live here rather than in `llm-pi-ai`, and the desktop profile selects its default model. The route is fixed and cannot be redirected through settings.

## Model Experience

### CodeBuddy request

#### What the model sees

The model receives the Harness system/developer content merged into one leading system message, followed by a user `Hello` only when Tencent's conversation grammar requires a user turn before the existing history. When image input and later Harness context occupy adjacent user messages, they become one ordered user content list so Tencent still evaluates the image. Text-only turns, attachments outside that case, tool declarations, and later history otherwise preserve pi-ai's Chat Completions conversion.

#### Token effect

The inserted `Hello` costs only a few tokens in common tokenizers and appears only when the existing first non-system turn is not from a user. Merging system/developer messages adds separators but no semantic instruction; the provider tokenizer determines the exact count.

#### KV Cache effect

Stable system content and normalized history preserve a stable multi-turn prefix. Request ids live only in headers and do not affect model-visible cache identity. Provider, model, or upstream-message changes can prevent reuse from the first changed token.

### CodeBuddy response

#### What the model sees

pi-ai converts CodeBuddy stream events into Harness reasoning, text, tool-call, usage, and finish chunks. Only content retained by the agent loop enters a later request.

#### Token effect

Every stream requests usage and reports it through the shared LLM vocabulary. The selected catalog model's output value is the request default; the provider enforces the final limit.

#### KV Cache effect

Retained response content appends to the next request without changing its earlier prefix. Transport headers and usage fields do not enter later model input.

## Known Limitations and Deferred Work

- **The catalog is a shipped snapshot** — Tencent can change the models its gateway serves without updating the package; a deployment or user adds or removes ids through the `models` override until the next release refreshes the fixed catalog.
- **Network and account eligibility remain external** — a registered route and stored key do not prove corporate-network reachability or model permission; the first request reports the provider failure.
- **Normalization follows the observed CodeBuddy protocol** — Tencent may change required headers or payload rules independently; focused tests prevent local drift but cannot guarantee an undocumented remote interface.
