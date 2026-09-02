# Agent Note：树外插件从 Electron 归档解析箱内 peer

Status: implemented

[English](2026-08-21-asar-fallback-nested-esm-imports.md) | 中文

## Problem

打包后的桌面 Host 从 `$DSH_HOME/profiles/<name>/node_modules` 加载树外 profile 插件。该模块对 `@deepseek-ai/dsh-tools` 这类箱内 peer 的嵌套 `import` 会走到 `$DSH_HOME/profiles/node_modules`，其 healer 符号链接指向 `app.asar`。Node 的 ESM `getPackageJSONURL` 不会把该符号链接路径当作归档成员（跟随链接之前路径不含 `.asar` 段，而归档本身是文件），因此用户安装社区组合包后启动会以 `ERR_MODULE_NOT_FOUND` 失败。Loader `resolveImport` 已经把配置行自身的裸包名转换成安装目录 `file:` URL；它不会对那个文件内部的导入运行。[桌面打包决策](../feature/2026-08-16-electron-desktop-tencent-codebuddy.zh.md) 把 JavaScript 留在归档内，只解包原生二进制。

## Decision

封闭运行时只要向 `boot` / `mountRootInclude` 传入 `bareModuleBaseUrl`，就会安装 `installInstallationResolveHook(bareModuleBaseUrl)`。该 hook 是进程级 `module.registerHooks` 解析回退：裸 specifier 失败时重试 `createRequire(installAnchor).resolve()`（Electron 可以在 `app.asar` 内应答），并返回含 `.asar` 的 `file:` URL，使后续加载走箱内插件已经使用的归档路径。之后的 `boot` 只替换这次 require；没有 `registerHooks` 的 Node 在锚点不含 `.asar` 时为空操作，锚点指向 `.asar` 则明确失败。相对、绝对和带 scheme 的 specifier 不会重试。

## Alternatives considered

**把 `node_modules/**` 解包到 `app.asar.unpacked` 并改写 healer 链接。** 拒绝，因为桌面打包决策只解包原生二进制；解包整个闭包会改变签名、Gatekeeper 扫描成本，以及箱内导入已经使用的归档布局。

**在 heal 时把每个 asar 包提取到磁盘。** 拒绝，因为它会在 `$DSH_HOME` 下复制一份安装，必须在每次应用更新时失效，并且会把 healer 条目变成真实目录，而 healer 已经拒绝这种条目。

**把 fallback `package.json` 的 `exports` 改写成指向 asar 的绝对 `file:` URL。** 拒绝，因为 Node 要求 `exports` 目标以 `./` 开头，生成的 shim 也无法覆盖每个子路径导出。

## Consequences

树外桌面插件可以导入安装闭包中的任何包，无需在 profile 本地再装一份。源码启动和未传入 `bareModuleBaseUrl` 的宿主不受影响。该 hook 是进程全局的，因此需要缺失 peer 的测试必须在安装 hook 之前运行，或使用安装目录也无法解析的名称。打包桌面仍然不解包 JavaScript 包。后续改动还会在安装锚点路径含 `app.asar` 时用 ESM 代理修复 `$DSH_HOME/profiles/node_modules`（[asar 模块回退代理](2026-09-02-asar-module-fallback-proxies.zh.md)），使花名册健康检查及其他沿符号链接路径的 `existsSync` 调用看到普通包目录；对父目录查找仍会错过的嵌套导入，该 hook 继续有效。

## Verification

`packages/boot/app-boot/tests/installation-resolve-hook.spec.ts` 会准备一个仅存在于安装目录的唯一 peer 和兄弟插件目录。安装 hook 前的进程内导入失败。子进程 `node --import tsx/esm` 调用 `installInstallationResolveHook` 后再导入该插件则成功，对两棵树都不包含的名称仍然失败。必须使用子进程，因为 Vitest 的模块运行器不会调用 `module.registerHooks`。
