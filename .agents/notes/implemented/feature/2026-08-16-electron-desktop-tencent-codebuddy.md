# Agent Note: Electron desktop with key-only Tencent CodeBuddy setup

Status: implemented

English | [中文](2026-08-16-electron-desktop-tencent-codebuddy.zh.md)

## Problem

The graphical Harness requires a local command plus an external browser. A desktop distribution needs one application lifecycle without duplicating the established Web client, Host composition, session persistence, or configuration services. Tencent employees also need the internal CodeBuddy route without translating TT Switch provider details into a large Harness profile: ordinary setup must require only their key, while a nonstandard CodeBuddy installation may override its client-state database.

Electron adds a module-loading constraint. Cordis normally imports profile plugins through a Node-private module adapter, but Electron does not expose that adapter. Loader entries may come from nested Includes, Groups, presets, and runtime `ctx.loader.create()` calls, so resolving only the bootstrap include would leave later plugin imports broken.

## Decision

**Electron reuses the assembled Web application over a private loopback Host.** `apps/desktop` starts the shipped `desktop` profile in-process, obtains its ephemeral `127.0.0.1` Web server URL, and loads that URL in a sandboxed BrowserWindow. The main process owns the single-instance lock and Host disposal. The renderer keeps the existing client-plugin graph and HTTP/WebSocket carrier; no desktop-specific frontend or protocol fork exists.

**The desktop profile is `base + web-app + desktop-app`.** The final layer changes only deployment facts: ephemeral loopback binding, no printed URL or Web-surface prompt context, no client HMR, the direct DeepSeek adapter retained, Tencent CodeBuddy mounted, and `tencent-internal/gpt-5.6-sol` selected. The Electron launcher disables user-patch watching because its runtime does not provide the Node facilities needed by the HMR watcher. Desktop state defaults to an Electron-owned Harness home rather than the CLI home.

**Tencent wire configuration is fixed; selectable models follow the local CodeBuddy desktop client.** `dsh-llm-tencent-codebuddy` owns the `https://copilot.tencent.com/v2` endpoint, OpenAI Chat Completions protocol, CodeBuddy route/IDE headers, request identities, message normalization, streaming usage, minimum output limit, and tool-choice adaptation observed in TT Switch. Tencent evaluates images only from its current user message, while Harness may append workspace instructions as another adjacent user message. The adapter merges adjacent user messages only when the run contains image content, preserving part order and leaving ordinary text-only history unchanged. The adapter serves a package-owned fixed catalog of the 29 desktop chat models (the `craft`/`ask`/`plan` union projected once from a captured desktop-client cache); a configured `models` list replaces it, which is how the Models card edits the directory (see [model-selection join note](2026-08-16-tencent-model-selection-joins-cache-and-user-models.md)). It reuses pi-ai through public profile-resolution and request-preparation hooks. The Models onboarding coordinator selects Tencent CodeBuddy before official DeepSeek when both desktop targets are composed, then falls back to DeepSeek when Tencent is omitted; the desktop composition therefore presents the Tencent key field first while retaining both model catalogs and stores the secret through the existing credential service.

**Loader import resolution is a per-instance host hook applied by every EntryTree.** Vendored Loader exposes `resolveImport(specifier, parentURL, attributes)`. `EntryTree.import()` invokes it before either the private adapter or native dynamic import. App boot supplies a resolver backed by `createRequire(installAnchor).resolve()` when a closed runtime names `bareModuleBaseUrl`, converting bare package names to absolute file URLs while preserving config-relative imports. Client-module discovery uses the same hook for package metadata instead of following writable-profile symlinks into an Electron archive. The maintained profile module fallback remains the installed dependency closure that makes those package names resolvable. The desktop deploy manifest explicitly supplies every required workspace peer in that closure, and the repository runtime-closure gate audits both executable deploy roots. This covers nested and runtime-created trees and works both with and without the private Node adapter, including an Electron archive whose writable profile lives outside the application tree.

**macOS distribution uses separate architecture-specific ASAR DMGs.** One packaging entry builds `arm64` and `x64` DMGs with the architecture in each filename; no Universal application is produced. Electron Builder archives JavaScript and runtime assets, excludes TypeScript, source maps, and package-root development material, and unpacks only native libraries and executables that must exist as ordinary files. Per-architecture filters retain only the matching Sharp, Koffi, ripgrep, node-pty, and native-addon packages. Developer ID signing uses the identity available on the build host; distribution requires the same artifacts to complete Apple notarization rather than asking recipients to disable Gatekeeper quarantine.

**The Electron window denies renderer privilege escalation.** Context isolation and Chromium sandboxing are enabled, Node integration is disabled, in-window navigation is limited to the application origin, and only ordinary external HTTP(S) URLs are handed to the system browser.

## Alternatives considered

**Rewrite the application with Tauri.** Rejected because it would introduce a second native build and bridge while the existing TypeScript Host and Web client already form the complete product.

**Replace the Web carrier with Electron IPC.** Deferred because it would require a second carrier implementation and broader protocol verification without improving the requested key-only workflow. The loopback server remains bound to one ephemeral local port. This supersedes the IPC-only direction reserved by the earlier [GUI layering note](../architecture/2026-07-19-gui-layering-and-rpc-protocol.md) while retaining its client/Host separation.

**Continue opening the system browser.** Rejected because it does not provide one client lifecycle or a distributable desktop application.

**Depend on the Node-private Loader adapter.** Rejected because Electron does not provide it, and resolving only top-level rows misses imports created by nested or runtime Loader trees.

**Ship one Universal macOS application or distribute an unpacked `.app`.** Rejected because a Universal build carries both Electron and native dependency architectures, while an unpacked application exposes the full file tree to transfer and Gatekeeper scanning. Separate DMGs make the recipient architecture explicit and keep each transfer to one runtime.

**Ask users to configure a generic pi-ai provider profile.** Rejected because endpoint, protocol, model metadata, and CodeBuddy request rules are deployment constants. Making them editable increases secret-redirection risk and makes first use depend on protocol knowledge.

**Keep serving a built-in catalog.** Rejected because a release snapshot cannot represent the models the signed-in CodeBuddy desktop client currently offers and would make an unusable local cache look healthy. A missing or invalid client cache fails the provider instead.

**Discover through Tencent's `/models` route.** Rejected because CodeBuddy model availability is delivered through its product configuration rather than a general OpenAI-compatible discovery endpoint. Reading that local cache also avoids a credentialed startup request.

## Consequences

The repository can start and package one Electron application whose default route is Tencent CodeBuddy while the Models page retains the official DeepSeek route and its catalog. The Tencent selector mirrors desktop-chat modes in the local CodeBuddy client; its settings card rereads the database and chooses which cached ids the composer lists. A client without a usable cache cannot load the Tencent adapter. The configured `gpt-5.6-sol` default can be absent from the account cache, in which case the composer remains unavailable until the user selects an offered model. When neither route is usable, first-run onboarding asks for the Tencent key before falling back to DeepSeek. Browser and desktop surfaces share the same client packages and Host APIs; desktop-specific behavior stays in one profile layer and one launcher. Tencent protocol changes require an adapter release rather than user reconfiguration. Packaged runtimes import bare plugins without Cordis's private Node adapter when app boot supplies its resolver, and the Loader vendor log records that local extension.

The macOS build produces separate Apple-silicon and Intel DMGs. Each assembled application contains one Electron architecture and only its matching optional native packages; its ASAR unpack directory contains the native binaries required at runtime rather than whole dependency directories. The artifacts remain local-only unless Developer ID signing and Apple notarization both succeed.

The application still opens one random loopback listener and depends on corporate network reachability plus a valid Tencent account. Source and packaged smoke tests prove boot, onboarding, credential persistence, navigation policy, teardown, and native loading on both macOS architectures without sending a model request; the keyless browser snapshot proves that only desktop-chat cache entries, not `cli`-only entries, reach the shared client selector and that an image remains in Tencent's current user message when workspace instructions follow it. Remote authentication and model output require an authorized key and remain external verification.
