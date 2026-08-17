# `@deepseek-ai/dsh-desktop`

English | [中文](README.zh.md)

Electron application for DeepSeek Harness. The main process boots the shipped `desktop` profile in-process, loads the existing Web frontend from a random loopback port, and owns Host teardown when the last window closes. The renderer remains the same client plugin graph as `dsh web`; the application adds no second UI implementation.

## Run from source

Build the repository once, then launch Electron:

```sh
npx --yes pnpm@11.7.0 run build
npx --yes pnpm@11.7.0 run desktop:start
```

On a fresh desktop home, the Models onboarding dialog asks only for a Tencent CodeBuddy key. Saving writes the secret through the Harness credential service under `TENCENT_CODEBUDDY_API_KEY`; the provider endpoint, protocol, model catalog, capacities, and request headers are package-owned. The Tencent adapter serves its fixed 29-model catalog on any machine — no local state required — and the Models card edits that directory through its 自定义设置 fold exactly like the direct DeepSeek card. The Models selector also retains the direct DeepSeek catalog. The configured desktop default remains `tencent-internal/gpt-5.6-sol`, which is part of the fixed catalog.

Unless `DSH_HOME` is already set, desktop state lives under Electron's per-user application-data directory in `harness/`. The process uses the operating-system home directory as the initial workspace.

## Package

Keep the workspace install intact when packaging. Electron Builder and the TypeScript compilers are development dependencies, while the application production closure contains workspace links; deleting `node_modules` and reinstalling with `npm ci --only=production` removes the tools and local package graph required to assemble this application. Electron Builder excludes development dependencies and package scripts from the packaged application.

Build both macOS DMGs after one repository build:

```sh
npx --yes pnpm@11.7.0 run desktop:package:mac
```

This command emits `DeepSeek Harness-<version>-mac-arm64.dmg` for Apple silicon and `DeepSeek Harness-<version>-mac-x64.dmg` for Intel. Each artifact contains one Electron architecture; the build never emits a Universal application.

Build only one architecture when the other artifact is not needed:

```sh
npx --yes pnpm@11.7.0 run desktop:package:mac:arm64
npx --yes pnpm@11.7.0 run desktop:package:mac:x64
```

Build an unpacked application directory for the current architecture when inspecting its contents or launching it locally:

```sh
npx --yes pnpm@11.7.0 run desktop:package:dir
```

The root commands build the complete repository first. Electron Builder writes artifacts under `apps/desktop/dist/` and derives every platform's application icon from `apps/web/public/favicon.svg`. JavaScript and runtime assets live in `app.asar`; only native addons, required dynamic libraries, ripgrep, and the node-pty helper remain in `app.asar.unpacked`. macOS packages retain only the target architecture's Sharp, Koffi, ripgrep, node-pty, and native-addon binaries, and omit Linux-only Landlock packages. TypeScript sources, declarations, source maps, and package-root test, documentation, and example directories are excluded.

The desktop package is the executable deploy root: its production dependencies explicitly supply every required workspace peer reachable from the shipped profile. `pnpm run verify-runtime-closure` checks this closure before release so Electron Builder cannot silently omit a plugin's service packages.

## GitHub Actions release

The `Desktop macOS` workflow builds the two DMGs as separate native matrix jobs: Apple silicon runs on `macos-14`, and Intel runs on `macos-15-intel`. The desktop manifest declares both architectures' platform packages explicitly because pnpm 11 does not install transitive platform binaries for Electron Builder. Configure these secrets in the `macos-signing` GitHub environment before dispatching it:

- `MAC_CERTIFICATE_P12_BASE64`: the Developer ID Application certificate and private key exported as a password-protected PKCS#12 file, then Base64 encoded.
- `MAC_CERTIFICATE_PASSWORD`: the PKCS#12 export password.
- `APPLE_ID`: the Apple developer account used for notarization.
- `APPLE_APP_SPECIFIC_PASSWORD`: an app-specific password for that Apple ID.
- `APPLE_TEAM_ID`: the Apple Developer team identifier associated with the signing identity.

Run the workflow manually from GitHub Actions, or push a `desktop-v*` tag. Each job builds the repository, verifies the desktop runtime dependency closure, signs and notarizes the application, signs the DMG, submits the final DMG for notarization, staples both artifacts, mounts the installer, and verifies Gatekeeper acceptance. Packaging retries only when `dmgbuild` reports that a temporary DeepSeek Harness volume remains busy during detach; other failures exit immediately. The downloadable workflow artifact contains one architecture-specific DMG and its SHA-256 file.

## Window and Host lifecycle

The BrowserWindow enables context isolation and the Chromium sandbox, disables Node integration, keeps in-window navigation on the application origin, and opens ordinary external HTTP(S) links in the system browser. A single-instance lock focuses the existing window on a second launch. The local Host binds only `127.0.0.1` on an ephemeral port, advertises no LAN trust, disables client HMR and user-patch watching, and is disposed before Electron exits.

## Known limitations

- **A distributable macOS DMG requires Developer ID signing, notarization, and stapled tickets for both the application and final disk image** — the GitHub workflow fails if credentials are absent or any signature, notarization, staple, mounted-application, or Gatekeeper check fails. Treat local packaging output as inspection-only; do not ask recipients to bypass Gatekeeper by clearing quarantine attributes.
- **Tencent access still depends on the corporate network and a valid CodeBuddy key** — storing a key proves only local configuration; the provider decides authentication and network reachability on the first request.
- **The Tencent model catalog is a shipped snapshot** — Tencent changes to its gateway models reach this application through the next package release, or through a user `models` override on the Models card.
- **The renderer uses a loopback HTTP carrier** — the random port is process-local and not printed, but this application does not replace the Web carrier with Electron IPC.
