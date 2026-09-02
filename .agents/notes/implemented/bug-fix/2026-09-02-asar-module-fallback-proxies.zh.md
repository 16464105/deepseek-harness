# Agent Note: Electron asar 安装用 ESM 模块代理修复 profiles 回退

Status: implemented

[English](2026-09-02-asar-module-fallback-proxies.md) | 中文

## 问题

打包桌面把 `$DSH_HOME/profiles/node_modules` 修成指向 `app.asar` 的操作系统符号链接，因为 `isPackagedExecutable` 只识别 pkg 的 `process.pkg`。Electron 仍可通过 `createRequire(installAnchor)` 与 [asar 嵌套导入钩子](2026-08-21-asar-fallback-nested-esm-imports.zh.md) 导入这些包，因此 Host 能启动。预设健康检查不能：`packageInstalled` 从 profile 基准向上用 `existsSync(.../node_modules/<pkg>/package.json)` 查找，而 Electron 的 asar 文件系统在路径仍指向符号链接、尚未变成含 `.asar` 的路径时对该查找返回 `false`。于是每个随附预设都显示为 broken，并列出大量「names a plugin that cannot be resolved」行，尽管这些插件其实已经挂载。

## 决策

只要安装锚点路径含 `.asar`，`healProfilesModuleFallback` 就写入与 pkg `/snapshot` 相同的 ESM 代理。后续启动会把过期的 asar 符号链接替换为代理。预设健康检查因此能在 profiles 回退下看到真实的磁盘 `package.json`，与 Node 普通的父目录查找一致。

## 考虑过的替代方案

**只让 `packageInstalled` 对符号链接 `readlink` 再 `existsSync` asar 目标。** 不能作为唯一修复：花名册健康会恢复，但其他沿已修复符号链接路径做 `existsSync`/`stat` 的调用仍会假阴性，而且 heal 仍会留下 asar 嵌套导入 note 已视为敌意的载体。

**把 JavaScript 包装进 `app.asar.unpacked`，让符号链接落到普通文件。** 未采用，因为桌面打包决策只解包原生二进制；改变该布局会影响签名与每个箱内导入的归档体积。

**在 Electron 内跳过基于解析的预设健康检查。** 未采用，因为 `broken` 驱动选择器过滤与挂载拒绝；静默它会重新出现无法启动却显示健康的卡片。

## 后果

打包桌面启动会把共享 profiles 模块回退改写为代理，并在行能在 asar 安装中解析时把随附预设标为健康。源码启动与普通 Node 安装仍使用符号链接。asar 嵌套导入解析钩子仍保留，供自身导入仍需安装锚点回退的树外模块使用。

## 验证

`packages/boot/app-boot/tests/profile.spec.ts` 在含 `app.asar` 的路径下搭建安装锚点，在 profiles 回退中放入过期符号链接，执行 heal，并断言该条目变为代理目录、其 `package.json` 存在且入口模块可导入。
