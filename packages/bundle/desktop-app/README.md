# `@deepseek-ai/dsh-desktop-app`

English | [中文](README.zh.md)

Desktop profile patch layer applied after [`dsh-base`](../base/README.md) and [`dsh-web-app`](../web-app/README.md). It retains the existing Host and browser client composition for Electron, binds the Web server to an ephemeral loopback port, suppresses the printed URL and Web-surface prompt context, disables client HMR, keeps the direct DeepSeek adapter, mounts [`dsh-llm-tencent-codebuddy`](../../llm/llm-tencent-codebuddy/README.md), and selects `tencent-internal/gpt-5.6-sol` as the default model.

The Electron main process, not this bundle, owns the native window, single-instance behavior, the desktop Harness home, and process shutdown. This package carries only a patch list plus the required package invariant companion.

The Tencent adapter resolves its selectable models from the local CodeBuddy client's desktop-chat cache. Its settings card can reread the cache and filter the shared chat selector. The bundle's configured `gpt-5.6-sol` default does not add an unavailable model to that list; users whose cache omits it choose one of the listed Tencent models.

## Model Experience

### Desktop composition

#### What the model sees

The bundle selects Tencent CodeBuddy as the default provider and removes the Web-only `harness:source` and `app:web-surface` context contributed by `web-runtime`. All other model-visible content comes from `dsh-base`, the selected agent preset, and the mounted DeepSeek and Tencent adapters.

#### Token effect

The bundle adds no prompt text. Disabling Web-surface context removes its source line, surface paragraph, and managed `DSH_WEB_URL` description from desktop sessions.

#### KV Cache effect

The selected provider and model determine the cache domain. The bundle itself adds no changing request prefix.

## Known Limitations and Deferred Work

- **This layer assumes `base + web-app` below it** — its id-targeted patches fail to provide a complete application when mounted by itself.
- **The default provider and model are intentionally fixed** — the adapter may exclude that model from an account's cache-backed catalog, while endpoint, protocol, and catalog resolution belong in the adapter rather than user patch defaults.
