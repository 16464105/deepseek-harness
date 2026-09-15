---
description: "The tencent-internal package group: the installable Tencent CodeBuddy profile bundle, for readers adding the internal route beside the shared LLM adapters."
kind: "package-group"
---

# tencent-internal/ — Tencent CodeBuddy profile bundle

English | [中文](README.zh.md)

## Summary

The tencent-internal group ships one installable profile bundle for Tencent CodeBuddy. Add it to a dsh profile to mount the `tencent-internal` route, serve the package-owned catalog, and select `hy3-ioa` as the default model. Store the CodeBuddy key on the Models page or through the credentials service; first-run does not prompt for it. The group sits beside `llm/` so this installable route is not nested inside the shared LLM adapter family.

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## Packages

| Package | Role | ctx key |
|---|---|---|
| [`llm-tencent-codebuddy/`](llm-tencent-codebuddy/README.md) | Installable Tencent CodeBuddy route with a package-owned catalog | registers on `ctx.llm` |

-----

<a id="related-documentation"></a>
## Related documentation

- [LLM streaming subsystem](../../docs/subsystems/llm-streaming.md) — the message, stream, and adapter contract this route registers on.
- [llm group](../llm/README.md) — the shared model-call service and official DeepSeek adapters.
- [Tencent CodeBuddy as an installable profile bundle](../../.agents/notes/implemented/architecture/2026-09-15-tencent-codebuddy-installable-profile-bundle.md) — why this package is both adapter and `dsh plugin` layer.

<a id="dev-note"></a>
## Dev Note

None.
