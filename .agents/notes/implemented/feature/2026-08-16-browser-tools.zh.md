# Agent Note:浏览器操作以单个 Playwright 驱动的工具插件交付

Status: implemented

[English](2026-08-16-browser-tools.md) | 中文

## Problem

harness 没有让模型操作真实浏览器的方式:没有导航、点击、表单填写、页面阅读。web 能力(`ctx.web`)只覆盖服务端搜索与抓取——它无法运行客户端 JavaScript、填写字段或观察渲染状态。模型只能把这类工作交给 shell 脚本,而环境中又没有安装浏览器自动化。

添加该能力需要回答三个设计问题,而代码库约定可以一次性回答:它是否需要公开的能力 seam(Service Definition / Provider / Consumer)、驱动哪个引擎、以及模型如何可靠地定位页面元素。

## Decision

浏览器操作以单个插件 `@deepseek-ai/dsh-browser`(包 `packages/browser/browser`)交付,合并三个角色。Playwright 会话位于私有 `BrowserController` 服务(`ctx.browser`)之后——没有其他包读取它,因此带 provider 注册表与选择逻辑的公开 seam 只会承载一个 provider 和一个消费者,别无他物;包规则拒绝只有一个内部调用者的公开服务。

工具通过 Playwright 1.61.1(直接依赖,精确锁定)驱动一个持久化 Chromium,遵循 Playwright `mode: 'ai'` 可访问性快照循环:

- `browser_navigate` 将绝对 http(s) URL 加载进持久页面。
- `browser_snapshot` 返回页面 aria 快照 YAML 与 `[ref=eN]` 标记,以及 URL 与标题。
- `browser_click` 与 `browser_type` 通过这些 ref 定位元素;快照中不存在的 ref 在任何浏览器交互前被拒绝(`STALE_REF`)。
- `browser_press_key` 按下按键,可选按住 `Control`/`Meta`/`Shift`/`Alt`。
- `browser_screenshot` 将视口捕获为 PNG 图像块,与 `read_image` 一致:仅在挂载持久 attachment 存储时注册,且除非路由模型声明图像输入否则拒绝执行。

引擎选择是一个配置项:`engine: chromium`(默认,Playwright 管理的 Chromium)或 `chrome`(宿主机 Chrome,经 `chrome` 启动通道)。启动是惰性的——浏览器进程在首次使用时启动、插件卸载时关闭。所有失败以封闭的 `BrowserError` 分类(`NO_BROWSER`、`NO_PAGE`、`STALE_REF`、`BAD_TARGET`、`BROWSER_FAILURE`)进入工具管道。

组合策略:base bundle 以**禁用**状态挂载 `browser` 行,因此任何默认组合都不会启动 Chromium;web-app bundle 启用该行,使工具仅属于 web/desktop 平面。headless/CLI 部署通过一行 patch 覆盖启用。

## Alternatives considered

- **像 `ctx.web` 一样的能力 seam**(一个包放 Service Definition、另一个放 Playwright provider、第三个放 `tool-browser` 消费者):拒绝——目前只有一个引擎和一个消费者;seam 只会为假设性的远程浏览器 provider 而存在,而包规则要求每个抽象都有当前所有者与需要。
- **通过 shell `chromium` 命令走 CDP**:拒绝——手写 DevTools 协议重复了 Playwright 已经拥有的能力(定位器、aria 快照、生命周期),且 Playwright 已在依赖图中(1.61.1,经 web 前端的测试工具)。
- **用 Puppeteer 代替 Playwright**:拒绝——仓库已锁定 Playwright 1.61.1,且其 `ariaSnapshot({ mode: 'ai' })` + `aria-ref` 定位器组合正是该特性想要的模型交互约定。
- **CSS 选择器作为模型面元素地址**:拒绝——模型无法凭空写出稳定的 CSS 选择器,而 Playwright 的可访问性快照会发出为这个循环设计的 ref。
- **无条件注册 `browser_screenshot`**:拒绝——其图像块必须引用已提交的 attachment,因此注册门槛遵循 `read_image` 的 attachments 条件模式。

## Consequences

- 模型获得真实浏览器:在单个持久页面上导航、阅读可访问性快照、点击、输入、按键与截图,无需委托给 shell。
- 浏览器工具默认属于 web 平面;base 行默认禁用,启用/禁用按部署一行 patch 即可。
- 所有变更类工具声明并发不安全,因此共享页面永远不会收到交错的兄弟调用。
- 使用默认引擎的部署需一次性安装 Playwright Chromium 二进制;缺失二进制以可操作的 `NO_BROWSER` 错误呈现。
- `examples/headless-agent/tests/browser.snapshot.ts` 中的快照场景在 keyless mock 适配器下运行真实 Chromium,无浏览器二进制时自行跳过。
