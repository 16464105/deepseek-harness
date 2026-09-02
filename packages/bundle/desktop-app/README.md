---
description: "Desktop profile patch layer over dsh-base + dsh-web-app for the Electron application."
kind: "package-bundle"
---

# `@deepseek-ai/dsh-desktop-app`

English | [中文](README.zh.md)

## Summary

Desktop profile patch layer applied after [`dsh-base`](../base/README.md) and [`dsh-web-app`](../web-app/README.md). It retains the existing Host and browser client composition for Electron, binds the Web server to an ephemeral loopback port, suppresses the printed URL, default-browser handoff, and Web-surface prompt context, disables client HMR, keeps the direct DeepSeek adapter, mounts [`dsh-llm-tencent-codebuddy`](../../llm/llm-tencent-codebuddy/README.md), and selects `tencent-internal/gpt-5.6-sol` as the default model.

The Electron main process, not this bundle, owns the native window, single-instance behavior, the desktop Harness home, and process shutdown. This package carries only a patch list plus the required package invariant companion.

## Table of Contents

- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="model-experience"></a>
-----

<a id="dev-note"></a>
## Dev Note

This package is a pure patch carrier: no runtime code ships from `src`, and its invariant companion checks the composed profile wiring.

## Model Experience

### Default model selection

#### What the model sees

The default model route resolves to `tencent-internal/gpt-5.6-sol`; nothing else in the prompt or tool surface changes versus the web profile. The model sees the same prompt composition the web profile ships; only the default route differs.

#### Token effect

No token change from this layer: the model-catalog default swap adds nothing to any request.

#### KV Cache effect

None. The default selection is a deployment fact, not a session-log value.

## Known Limitations and Deferred Work

- **Composition-only layer** — the desktop patch is a composition fact; the Electron main process owns all native-window behavior and is documented by `apps/desktop`.
