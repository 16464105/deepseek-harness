# Agent Note: Packaged plugin tree loads through derived-cache discard and public exports

Status: implemented

[English](2026-09-02-packaged-plugin-tree-load.md) | 中文

## Problem

打包后的桌面 Host 把插件树当作一次 include 应用。任一 loader 条目拒绝导入或初始化都会让 include 失败，应用因此到不了窗口。三条彼此独立的拒绝走同一条路径：`session_projcache` 中身份已不再匹配 `checkpointIdentity` 的行在领域打开时以 `invalid-record` 失败；`dsh-llm-tencent-codebuddy` 导入 `@deepseek-ai/dsh-llm-pi-ai/src/*.ts`，而 asar 包并不附带这些源文件；`dsh-better-sidebar@0.13.1` 从 `@deepseek-ai/dsh-settings` 导入 `settingsNamespace`，而 settings 包并未导出它。第一条拒绝违背投影缓存契约：过期或不可读的缓存只应换来更长的尾部重放，而不是拒绝启动（[每会话文件](../architecture/2026-08-19-projection-cache-per-session-files.zh.md)）。第二条拒绝是打包运行时导入了工作区源码路径。第三条拒绝是已随桌面发布的插件调用了缺失的公开辅助函数。

## Decision

`DomainFacility.open` 会省略未能通过 zod schema 的 `per-record` 表行，记一条点名领域、表与键的警告，然后继续。`single` 布局的记录或任何全局不符合时仍以 `invalid-record` 拒绝打开。json 后端已经把畸形或版本不同的 per-record 文档读作不存在；领域打开现在对版本匹配但值已漂移的文档做同样的丢弃。

`@deepseek-ai/dsh-llm-pi-ai` 从包根导出 `resolveProfiles`、`authContextFrom` 与 `credentialStoreFrom`。`dsh-llm-tencent-codebuddy` 从该包根导入这些辅助函数，打包后的 `lib/index.js` 图可以解析它们。

`settingsNamespace(value)` 是动态 settings namespace 的公开运行时品牌化与校验辅助函数。`register` 仍对字符串字面量做类型检查；当 namespace 是常量或其他非字面量字符串时，插件使用该辅助函数。

## Alternatives considered

**只靠提高 `session_projcache` 版本，让 json 后端丢弃全部现有行。** 不能作为唯一修复：之后若再增加必填字段却忘记 bump，启动会以同样方式被打死。版本戳仍是 schema 所有者丢弃整代记录的方式；它不能替代按行的 schema 丢弃。

**在 `SessionProjectionCache` 内捕获打开失败并无领域继续运行。** 未采用，因为每个派生 per-record 领域都得重写同一套捕获，而 facility 已经是分类打开期记录损坏的地方。

**把 `dsh-llm-pi-ai` 的 `src/` 打进 asar 并在运行时加载 TypeScript。** 未采用，因为打包 Host 在普通 Node 下运行已构建的 `lib/`，没有 TypeScript 加载器。`./src/*` 导出仍只服务工作区源码启动路径。

**把桌面对 `dsh-better-sidebar` 的钉版本升到不再导入 `settingsNamespace` 的 alpha 线。** 推迟：桌面 profile 仍发布 `0.13.1`，且即使钉版本日后移动，该辅助函数仍是动态 namespace 的正确公开 API。

**让 include 在任一插件拒绝时 fail-soft。** 未采用，因为它会把第一方加载失败藏进一棵只挂载了一半的树。

## Consequences

schema 漂移的投影缓存行不再拒绝 Host 启动；该会话会失去列表捷径，直到下一次检查点。复用 pi-ai 传输的兄弟适配器必须从包根导入，而不能走 `src/` 子路径。打包桌面可以在当前 settings 包上加载 `dsh-better-sidebar@0.13.1`。`workspace` 这类权威 `single` 布局领域在遇到坏记录时仍然明确失败。

## Verification

`packages/storage/storage-domain/tests/domain.spec.ts` 打开一个同时持有一行有效记录与一行 schema 不符记录的 `per-record` 领域，提供有效行、省略不符行，并仍然拒绝 schema 不符的全局。同一文件保留 `single` 布局的 `invalid-record` 拒绝。`packages/llm/llm-pi-ai/tests/adapter.spec.ts` 断言包根再导出。`packages/llm/llm-tencent-codebuddy/tests/provider-wiring.spec.ts` 拒绝从 `src/` 导入 `dsh-llm-pi-ai`。`packages/settings/settings/tests/settings.spec.ts` 通过 `settingsNamespace` 为合法 namespace 品牌化并拒绝非法名称。
