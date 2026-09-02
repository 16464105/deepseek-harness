# Agent Note: 系统图标使用 DeepSeek 品牌蓝

Status: implemented

[English](2026-09-02-brand-blue-system-icons.md) | 中文

## 问题

`apps/web/public/favicon.svg` 把 DeepSeek 鲸鱼画成黑色，并在 `prefers-color-scheme: dark` 下切为白色。Electron Builder 从该 SVG 生成全部桌面应用图标，因此 Dock 与 Windows shell 得到的是透明底上的黑色标记，在深色壁纸上可读性差。应用内 `FishLogo` 与空态 hero 标记也使用 `currentColor`，因此侧栏与欢迎区 chrome 在浅色主题下仍为黑色。操作者期望的产品标记是白底桌面磁贴上的 DeepSeek 品牌蓝 `#4D6BFE`。本地构建还把侧栏标成 `DSH Local Build` / `DSH 本地构建`，而不是操作者使用的产品名。

## 决策

随附 Web favicon 保留同一鲸鱼路径，并在透明画布上使用恒定的 `fill="#4D6BFE"`。`website/public/favicon.svg` 携带同一文件。桌面打包把 `build.icon` 指向 `apps/desktop/build/icon.svg`：1024×1024 画布上的圆角白底，以及居中、缩小后的品牌蓝鲸鱼。`FishLogo`、空态 hero 标记与 wordmark 的领先鲸鱼共享导出的 `DEEPSEEK_BRAND_BLUE`（`#4D6BFE`）。本地构建侧栏与文档标题文案通过 `common.brand.localBuild`（en 与 zh）使用 `DeepseekHarness`。

本决策取代[已归档 favicon 暗色方案 note](../../archived/bug-fix/2026-08-10-web-favicon-dark-mode.md) 中随附系统图标的黑/白 SVG 配色。该归档仍是浏览器 chrome 曾自适应动机的历史说明；系统与应用内鲸鱼标记的现行颜色是品牌蓝。

## 考虑过的替代方案

**继续把透明 favicon 当作 Electron 图标源。** 未采用，因为 Dock 与桌面磁贴需要不透明白底；透明标记在深色壁纸上会消失。

**把操作者提供的光栅 JPG 作为图标源。** 未采用，因为仓库已持有精确矢量路径；重着色该路径可为 favicon、PWA 与 Electron 栅格化保持清晰缩放。

**应用内标记仍用 `currentColor`，只重着色 favicon。** 未采用，因为操作者把侧栏与 hero 标记视为同一产品图标，并期望那里也是品牌蓝。

## 后果

Web 标签页、安装 manifest 图标与文档站 favicon 显示透明底品牌蓝鲸鱼。新打包的桌面应用在 Dock 与桌面上显示圆角白底与较小的品牌蓝鲸鱼。侧栏品牌标记与空态 hero 鲸鱼保持品牌蓝且无白底。本地构建在侧栏标题与默认文档标题中显示 `DeepseekHarness`。跳过 Electron Builder 图标再生的重建可能保留缓存的 `.icns`，直到下一次完整打包。仍忽略 SVG favicon 的旧版 Safari 在本树中仍无 PNG 兜底；该缺口未变。注入 `BrandWordmark` 作为侧栏名称的官方构建保留该 wordmark 画稿；仅本地构建 locale 字符串变更。

## 验证

`apps/web/tests/pwa-manifest.e2e.ts` 断言构建后的 `favicon.svg` 含有 `fill="#4D6BFE"` 且不含 `fill="#000"`。`apps/desktop/tests/icon.spec.ts` 断言 `build/icon.svg` 含有圆角白底与品牌蓝填充，且 `package.json` 的 `build.icon` 指向它。`packages/client/ui-primitives/tests/icons.client.spec.tsx` 断言 `FishLogo` 绘制 `DEEPSEEK_BRAND_BLUE`。侧栏与 built-boot 测试断言本地构建品牌字符串 `DeepseekHarness`。
