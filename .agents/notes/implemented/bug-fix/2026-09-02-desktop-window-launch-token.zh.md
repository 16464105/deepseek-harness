# Agent Note: 桌面窗口加载进程启动令牌

Status: implemented

[English](2026-09-02-desktop-window-launch-token.md) | 中文

## 问题

打包后的桌面 Host 与 `dsh web` Host 共用 Connection 的浏览器会话门槛：`GET /` 既没有进程启动令牌、也没有有效签名 cookie 时返回 `401`，正文为 `dsh web authentication required; reopen the URL printed by dsh web.`。插件树开始应用之后，Electron 窗口在随机端口上加载了裸回环 origin。桌面绑定 `port: 0`，先前进程的 cookie 无法匹配新的 authority，而桌面 profile 又不打印操作者可以重新打开的 URL，因此首次导航总会收到这条 401。同一进程仍继承 `dsh-web-app` 默认的 `openBrowser: true`，系统浏览器可能拿到已认证 URL，原生窗口却拿不到。

## 决策

桌面主进程用 `connection.authenticatedUrl` 为 `http://127.0.0.1:<port>` 构造窗口 URL，并在首次加载与之后重建窗口时使用该 URL。桌面补丁设置 `openBrowser: false`，因此进程不会再把启动令牌交给系统浏览器。401 正文仍是共享的 Connection 诊断；desktop 从不打印该 URL。

## 考虑过的替代方案

**在桌面 profile 中关闭浏览器会话认证。** 未采用，因为 renderer 仍使用回环 HTTP 载体，而[启动令牌决策](../architecture/2026-08-24-browser-token-authentication.zh.md)认证该载体上的全部 Host API。再开一条未认证的桌面路径会把该决策已经关掉的缺口重新打开。

**在固定端口上保持持久的桌面 cookie authority。** 未采用，因为桌面 profile 绑定临时端口以避免两份副本冲突，且 cookie 名称绑定 authority。固定端口在没有 cookie 时仍要求首次导航出示进程令牌。

**保留系统浏览器交接，让操作者从 401 恢复。** 未采用，因为 desktop 已经拥有窗口，把带启动令牌的 URL 交给默认浏览器会把进程凭据写入该浏览器的历史记录。

## 后果

打包或从源码启动的桌面窗口可以完成与 `dsh web` 相同的令牌换 cookie。启动令牌留在 Electron 会话内。操作者在另一个浏览器打开裸回环 origin 仍会收到这条共享 401；那是预期拒绝，不是恢复路径。

## 验证

`apps/desktop/tests/navigation.spec.ts` 断言 `authenticatedApplicationUrl` 要求 Connection 认证 `http://127.0.0.1:<port>`。`packages/bundle/desktop-app/tests/desktop-app.spec.ts` 固定组合后的 `web-runtime` 行带有 `openBrowser: false`。
