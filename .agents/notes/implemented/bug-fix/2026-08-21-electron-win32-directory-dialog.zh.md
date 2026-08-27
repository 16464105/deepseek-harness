# Agent Note：打包桌面使用 Electron 的 Win32 目录选择器

Status: implemented

[English](2026-08-21-electron-win32-directory-dialog.md) | 中文

## Problem

在打包后的 Windows 桌面里选择工作区会报 `win32 folder dialog worker exited before reporting a result`。原生选择器以 `ELECTRON_RUN_AS_NODE=1` spawn `process.execPath` 来运行 `lib/worker.cjs`。该子进程无法从 `app.asar` 加载 worker，因此打包器把入口改写到 `app.asar.unpacked`。子进程的 `require('koffi')` 再从解包入口往 `node_modules` 回走，找不到仍留在归档里的包（与 [asar 嵌套 ESM 导入](2026-08-21-asar-fallback-nested-esm-imports.md) 同类缺口），于是在没有 IPC 结果的情况下退出。spawn 还把 stderr 设成 inherit 而不是 pipe，Host 错误里没有 worker 诊断。[koffi 子进程选择器](../feature/2026-08-02-win32-in-process-folder-dialog.md) 仍是普通 Node 的 Windows 层级；它本来就不是为 Electron 归档设计的。

## Decision

`pickNativeDirectory` 在 `win32` 上只要 `process.versions.electron` 已设置（打包桌面 Host 跑在主进程），就使用 Electron 的 `dialog.showOpenDialog`。普通 Node Windows 仍只保留 koffi 子进程这一原生层级。worker spawn 改为 pipe stderr，使静默子进程退出仍能附上真实失败。桌面 `asarUnpack` 用 `**/dsh-host-directory-picker-native/lib/**` 与 `**/koffi/**` 匹配嵌套布局，以便非 Electron 的打包 Host 仍能加载 worker 及其原生绑定。

## Alternatives considered

**继续为打包 Electron 修补 koffi 子进程（asar 解包再加 worker 内的 resolve hook）。** 否决：Electron 已经拥有主进程目录选择器；为一次对话框再做一条逃出归档的路径，是 [asar 回退](2026-08-21-asar-fallback-nested-esm-imports.md) 问题的第二份副本。

**worker 退出后回退到 browse 对话框。** 否决：本机桌面操作者应当得到操作系统文件夹选择器；子进程静默退出是打包缺陷，不是缺少工具。

**在 macOS 上只打 NSIS Windows 包。** 否决：非 Windows 宿主上 `makensis` 需要 Wine。zip 目标可以在没有 Wine 时产出 `DeepSeek Harness.exe`；NSIS 仍留给 Windows runner（或 Wine）。

## Consequences

打包后的 Windows 桌面选择工作区文件夹不再依赖 spawn 的 asar worker。普通 Node Windows 不变。从 macOS 交叉打包默认产出 zip，除非本机有 Wine 来打 NSIS。

## Verification

`packages/host/directory-picker-native/tests/electron-dialog.spec.ts` 用伪造的 Electron API 覆盖中止、取消、空路径和焦点窗口父子关系。`native-picker.spec.ts` 钉住 Electron 与 koffi 的分叉。worker stderr 附着仍在 `win32-dialog.spec.ts`。
