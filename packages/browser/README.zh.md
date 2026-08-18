# browser/ — 浏览器操作能力

[English](README.md) | 中文

面向模型的浏览器操作:通过 Playwright 驱动一个持久化的本地 Chromium,以可访问性快照交互循环的形式暴露给模型。

| 包 | 职责 |
|---|---|
| [`browser/`](browser/README.md) | `browser_*` 工具集(`browser_navigate`、`browser_snapshot`、`browser_click`、`browser_type`、`browser_press_key`、`browser_screenshot`)及其背后的 Playwright 会话控制器。 |

该能力以单插件形式交付:会话控制器除工具外没有其他消费者,因此保持为私有服务而非公开 seam。[浏览器工具决策](../../.agents/notes/implemented/feature/2026-08-16-browser-tools.md)记录了工具集、`aria-ref` 交互约定、引擎选择与组合策略(base bundle 行默认禁用,web-app 层启用)。
