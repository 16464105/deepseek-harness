# @deepseek-ai/dsh-browser

[English](README.md) | 中文

面向模型的浏览器操作工具,通过 [Playwright](https://playwright.dev) 驱动一个持久化的本地 Chromium。本包拥有完整工具集——`browser_navigate`、`browser_click`、`browser_type`、`browser_press_key`、`browser_snapshot`、`browser_screenshot`——以及其 schema、固定的模型面文案、`aria-ref` 交互约定、引擎选择与依赖 attachment 的截图路径。Playwright 会话位于私有 `BrowserController` 服务之后;没有其他包读取它,因此该能力以单插件形式交付而不暴露公开 seam([决策](../../../.agents/notes/implemented/feature/2026-08-16-browser-tools.md))。

工具遵循 Playwright `mode: 'ai'` 可访问性快照循环:`browser_snapshot` 返回页面的 aria 快照 YAML 与 `[ref=eN]` 标记,`browser_click`/`browser_type` 通过这些 ref 定位元素。快照中不存在的 ref 会在任何浏览器交互前被拒绝,因此过期引用会以模型可读的错误失败,而不是点错元素。

## 工具

| 工具 | 参数 | 行为 |
|---|---|---|
| `browser_navigate` | `url`(string) | 将绝对 http(s) URL 加载进持久页面。 |
| `browser_snapshot` | — | 返回带 `[ref]` 标记的 aria 快照,以及页面 URL 与标题。 |
| `browser_click` | `ref`(string) | 点击上一次快照中 ref 所引用的元素。 |
| `browser_type` | `ref`(string)、`text`(string) | 用 `text` 替换所引用文本字段的内容。 |
| `browser_press_key` | `key`(string)、`modifiers`(string[]) | 按下一个键,可选按住 `Control`/`Meta`/`Shift`/`Alt`。 |
| `browser_screenshot` | — | 将视口捕获为 PNG 图像块(仅图像输入路由)。 |

除 `browser_snapshot` 外的所有工具都声明 `isConcurrencySafe: () => false`:它们修改同一个共享页面,因此兄弟工具调用不会交错。`browser_screenshot` 仅在挂载了持久 attachment 存储(`ctx.attachments`)时注册,因为其图像块必须引用已提交的 attachment;execute 主体对直接调用者保留同样检查。

## 配置

| 键 | 默认 | 含义 |
|---|---|---|
| `engine` | `chromium` | 浏览器引擎:`chromium`(Playwright 管理的 Chromium)或 `chrome`(宿主机 Chrome/Chromium,经 `chrome` 启动通道)。 |
| `headless` | `true` | 无可见窗口启动。 |

```yaml
- id: browser
  name: '@deepseek-ai/dsh-browser'
  disabled: false
```

浏览器进程在首次使用时启动,而非插件加载时;卸载插件会关闭浏览器、上下文与页面,因此重载不会遗留孤儿进程。缺失二进制以结构化 `NO_BROWSER` 失败呈现,并给出可操作的提示(`chrome` 引擎会指明 `chromium` 回退方案)。

## 引擎与浏览器安装

Playwright 1.61.1 是直接依赖。保持默认 `chromium` 引擎的部署需一次性安装浏览器二进制(`pnpm exec playwright install chromium`,Linux 上加 `--with-deps`);否则 Playwright 在首次使用时报告缺失可执行文件,并翻译为 `NO_BROWSER` 错误。`chrome` 引擎在宿主机已有 Chrome/Chromium 安装时无需下载。

## 错误分类

所有浏览器失败都以 `BrowserError` 进入工具管道——封闭代码集为 `NO_BROWSER`(引擎无法启动)、`NO_PAGE`(页面关闭或崩溃)、`STALE_REF`(定位器不匹配)、`BAD_TARGET`(非 http(s) 或带凭据的 URL)、`BROWSER_FAILURE`(其他)。注册表在结构化错误元数据中暴露该代码,因此策略与 hooks 无需解析模型可见文本即可路由。

## Model Experience

### System prompt

#### What the model sees

一个与工具一同注册的指导段(`tool:browser`):

##### Browser guidance

```markdown
The browser tools drive one persistent Chromium page. Use browser_navigate to open an http(s) URL, then browser_snapshot to get the accessibility tree with [ref] markers; interact via browser_click/browser_type/browser_press_key using refs from the last snapshot. Re-run browser_snapshot before acting on elements that may have changed. browser_screenshot returns a viewport PNG to the model when the current model route declares image input.
```

#### Token effect

插件挂载期间每次请求固定指导成本。作用域工具限制不会移除这个独立注册的段落。

#### KV Cache effect

插件保持挂载且指导文案不变时前缀稳定。挂载或卸载插件会从第一个变化的提示段落开始使复用失效。

### Tool schemas

#### What the model sees

生成的[工具目录](../../../docs/tool-catalog.md#deepseek-aidsh-browser)列出全部六个 schema。引擎选择不会改变它们;仅当未挂载 attachment 存储时缺少 `browser_screenshot`。

#### Token effect

每个已注册工具的固定 schema 成本。无 attachment 存储时挂载插件会省略一个 schema;作用域限制可独立移除 schema。

#### KV Cache effect

定义与可见性不变时前缀稳定。插件生命周期、attachment 存储存在性、或作用域限制会从第一个变化的 schema token 开始使复用失效。

### Snapshot result

#### What the model sees

依次为 `<url>…</url>`、`<title>…</title>`,以及 `<aria-snapshot>…</aria-snapshot>` 内的 aria 快照 YAML,最后是固定指令 `Use [ref] values from this snapshot in browser_click and browser_type. Re-run browser_snapshot after actions that change the page.`。超过 200,000 字符的快照会被截断并标记。

#### Token effect

数据相关的页面内容,压缩前重复发送。

#### KV Cache effect

仅追加;新可见内容跟随可复用的请求前缀。

### Screenshot result

#### What the model sees

一个图像块(已提交的 attachment)旁附文本信封 `image/png image, <width>x<height> px, <bytes> bytes`。除非路由模型声明图像输入,否则执行拒绝,与 `read_image` 一致。

#### Token effect

每次调用一张图像;PNG 字节走 attachment 引用而非内联 token。

#### KV Cache effect

独立图像 attachment;文本信封仅追加。

### Action results and errors

#### What the model sees

成功动作返回 `Navigated to <url>`、`Clicked element <ref>. Run browser_snapshot to see the updated page.`、`Typed into element <ref>. …` 或 `Pressed <key>. …`。失败为 `Error: <message>` 并携带上述结构化代码。

#### Token effect

仅失败或执行动作的调用添加这些保留 token。

#### KV Cache effect

仅追加;新可见内容跟随可复用的请求前缀。

## Known Limitations and Deferred Work

- **浏览器范围的导航策略待定** — `browser_navigate` 接受模型提供的任何 http(s) URL;本包不定义域名允许/拒绝策略,需要该策略的部署应添加 `tools/pre-execute` guard。本包的 URL 校验仅覆盖协议与内嵌凭据。
- **单页单浏览器** — 插件在单个 Chromium 中保持单个页面;标签管理、多并发页面与多步脚本流程不在范围内。页面崩溃后重新启动需要新的 `browser_navigate`。
- **无远程浏览器提供方** — Playwright 引擎驱动本地进程;远程/browserless 部署需要独立提供方,本包不支持。
