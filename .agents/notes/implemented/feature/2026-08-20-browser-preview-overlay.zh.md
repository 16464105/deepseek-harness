# Agent Note: 浏览器实时预览浮层以静态双面包形式发布

Status: implemented

[English](2026-08-20-browser-preview-overlay.md) | 中文

## 问题

浏览器工具套件（`@deepseek-ai/dsh-browser`）驱动一个持久的 Playwright 页面，但页面外观对 DSH 界面前的人类不可见：截图返回给模型，从不回到用户的屏幕。观察 agent 通过浏览器工作的操作者希望有一个实时预览 —— Web 客户端中的一个浮动窗口，显示当前视口，在 agent 导航和点击时刷新。

早期原型证明该概念可作为**动态 Cordis 插件**（通过 `cordis_define` 按会话定义，Host 半端 + `shell.overlay` 占用者）。这种形式无法随打包的桌面/Web bundle 分发：动态插件只存在于定义进程的内存中，重启即消失，因此无法随产品分发。

## 决策

`@deepseek-ai/dsh-browser-popup`（包 `packages/browser/browser-popup`）以**静态双面包**形式发布预览，注册在 web-app 和 desktop-app bundle 中，位于它所依赖的 `browser` 行旁边。

- **Host 半端**（`src/index.ts`）：`BrowserPopupService extends TypertRemoteService` 提供 `shot`（视口 PNG 的字节安全 base64）、`pageInfo`（URL/标题）和 `navigate`。typert 生成器产出 `./remote` 和 `./typert` 产物，`packages/api/remotes` 挂载该命名空间，使 Web 客户端看到 `ctx.remote.browserPopup`。
- **Client 半端**（`src/client/`）：一个 `shell.overlay` 占用者（id `browser-popup`）—— 一个 React 组件，展开时每 1.5 秒轮询 `remote.browserPopup.shot()`，通过 `createImageBitmap` 解码 PNG，并以原生分辨率绘制到 canvas 上（CSS 缩放显示）。收起时是右上角药丸；展开时显示实时 canvas、页面标题和 URL，带刷新/最大化/折叠控件。错误渲染在页脚，绝不在 canvas 上。
- **字节安全 base64**：Host 的 `btoa` builtin 仅支持 UTF-8，会损坏 >= 0x80 的字节，这静默破坏了第一个原型产生的每一个 PNG。该包自带字节安全编码器（`bytesToBase64`）并配有回归测试。
- **组合**：base bundle 携带依赖；web-app 和 desktop-app patch `insert` `browser-popup` 行。两个 bundle 行都假定 `browser` 工具套件已启用（浮层通过 Remote 服务消费 `ctx.browser`）。

## 考虑的替代方案

- **原样发布动态插件**：否决 —— 动态插件仅存在于进程内存，无法随打包的桌面/Web bundle 分发；分享意味着每次会话重新定义。
- **提供截图的 `webServer` HTTP 路由**：否决 —— 在桌面壳中 Electron 框架拦截未知路径，路由永远无法应答；且静态形式更倾向于已经承载 Host→Client JSON 的 typert Remote 通道。
- **`<img>` 使用 `data:`/`blob:` URL**：否决 —— 桌面壳的 CSP 两者都拒绝；`createImageBitmap` + canvas 是绕过 `img-src` 限制的解码路径。
- **Host `btoa`**：否决 —— 它仅支持 UTF-8；PNG 字节必须使用字节安全编码器。

## 后果

- 打包的 Web 和桌面应用现在随附实时浏览器预览；操作者可以在 agent 工作时于右上角浮层中看到被驱动页面的更新。
- 预览仅显示：与页面交互仍通过 agent 的 `browser_*` 工具，而不是通过弹窗。
- 浮层在 `shell.overlay`（列表插槽）中是叠加的 —— 它从不遮蔽外壳界面，展开前点击穿透。
- 截图以 base64 形式通过 Remote 通道传输；非常大的视口每次轮询会产生数百 KB 的消息（1280×720 下 1.5 秒约 150 KB 可接受；窗口更大的部署可能延长 `REFRESH_MS`）。
- 该包自带 invariant 伴生插件（无运行时 invariant：它不拥有任何事件/数据关系）和一个覆盖 base64 编码器的 host spec。
