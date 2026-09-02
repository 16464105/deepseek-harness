---
description: "The browser-operation capability group: one persistent local Chromium driven through Playwright and the model-facing browser tool suite."
kind: "package-group"
---

# browser/ — browser-operation capability

English | [中文](README.zh.md)

## Summary

The browser group provides the harness's browser-operation capability: one persistent local Chromium driven through Playwright, exposed to the model as an accessibility-snapshot interaction loop. The core `browser` package owns the Playwright session controller and the `browser_*` tool suite; `browser-popup` adds a live preview overlay for the web client. This page maps the group; each package README owns its per-package contract.

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## Packages

| Package | Role | ctx key |
|---|---|---|
| [`browser/`](browser/README.md) | Drives one persistent Playwright Chromium and exposes the `browser_*` tool suite to the model | `ctx.browser` |
| [`browser-popup/`](browser-popup/README.md) | Live browser preview overlay for the web client | `ctx.browserPopup` |

-----

<a id="related-documentation"></a>
## Related documentation

- [tool-catalog](../../docs/tool-catalog.md) — the model-facing tool schema registry.

-----

<a id="dev-note"></a>
## Dev Note

The browser session is a single persistent page: the model navigates it, snapshots it, and interacts through accessibility refs. No headless browser binary ships with the harness — the Playwright Chromium install is a development and CI prerequisite.
