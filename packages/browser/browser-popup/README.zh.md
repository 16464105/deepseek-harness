# @deepseek-ai/dsh-browser-popup

[English](README.md) | 中文

DSH Web 客户端的浏览器实时预览浮层：在右上角悬浮窗中实时显示模型所驱动的 Playwright 页面，每 1.5 秒刷新一次。Host 半端暴露一个 Remote 服务（`browserPopup`），提供 `shot`（字节安全的 base64 截图）、`pageInfo`（URL/标题）和 `navigate`；Client 半端占据 `shell.overlay` 插槽，以原生分辨率在 canvas 上绘制截图（CSS 缩放显示）。

该浮层是可叠加的：它只向全框 `shell.overlay` 列表插槽贡献一个条目，从不替换外壳界面，展开前点击穿透。它与 `browser` 工具套件（依赖同一个 `browser` 服务）一起发布，只在启用浏览器时有意义。

## Remote 接口

| 方法 | 返回 | 行为 |
|---|---|---|
| `shot` | `BrowserShotResult` | 将当前页面视口捕获为 base64 PNG（`png`、`byteLen`、`b64Len`）。 |
| `pageInfo` | `BrowserPageInfoResult` | 返回当前页面 URL 和标题。 |
| `navigate` | `BrowserNavigateResult` | 将持久页面导航到绝对 http(s) URL。 |

每个方法都惰性解析浏览器服务，并在浏览器不可用时返回 `{ ok: false, error }`，因此浮层降级为错误字符串而不是让 Remote 调用失败。

## Client 浮层

占用者（`shell.overlay` 中的 `browser-popup`）在展开时轮询 `remote.browserPopup.shot()`：

- 收起状态是右上角的小药丸（点击展开）。
- 展开状态显示实时 canvas（原生分辨率，CSS 缩放到适应），页面标题和当前 URL。
- `⟳` 强制刷新；`⛶`/`⤡` 切换近全屏（92vw × 90vh）；`✕` 折叠回药丸。
- 错误（解码失败、Remote 失败、浏览器不可用）渲染在页脚，绝不在 canvas 上。

## 组合

```yaml
# web-app bundle: enable the browser suite and add the overlay beside it.
- id: browser
  disabled: false
- insert:
    - id: browser-popup
      name: '@deepseek-ai/dsh-browser-popup'
```

该包是双面的：node 半端是 `browserPopup` Remote 服务（typert 生成的 `./remote` 客户端），浏览器半端是 `shell.overlay` 占用者。两个半端都需要 `@deepseek-ai/dsh-browser` 的 `browser` 服务，因此上述 bundle 行假定浏览器工具套件已启用。

## 已知限制

- 截图通过 typert Remote 通道以 base64 传输；大视口每次轮询会产生数百 KB 的消息。1.5 秒的间隔在 1280×720（约 150 KB）下保持管线轻量，但窗口非常大的部署可能更倾向于更长的 `REFRESH_MS`。
- 浮层仅显示：与驱动页面交互仍通过 agent 的 `browser_*` 工具，而不是通过弹窗。
