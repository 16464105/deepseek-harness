# browser/ — browser-operation capability

English | [中文](README.zh.md)

Model-facing browser operation: one persistent local Chromium driven through Playwright, exposed to the model as an accessibility-snapshot interaction loop.

| Package | Role |
|---|---|
| [`browser/`](browser/README.md) | The `browser_*` tool suite (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_press_key`, `browser_screenshot`) plus the Playwright session controller behind them. |

The capability ships as one plugin: the session controller has no consumer besides the tools, so it stays a private service rather than a public seam. The [browser tools decision](../../.agents/notes/implemented/feature/2026-08-16-browser-tools.md) records the toolset, the `aria-ref` interaction contract, engine selection, and the composition policy (the base bundle rows ship disabled; the web-app layer enables them).
