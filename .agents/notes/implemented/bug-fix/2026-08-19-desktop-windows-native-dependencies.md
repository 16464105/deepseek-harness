# Agent Note: Desktop Windows packages declare target-native dependencies

Status: implemented

English | [中文](2026-08-19-desktop-windows-native-dependencies.zh.md)

## Problem

The Windows x64 Electron package started with a Cordis include `AggregateError` even though the workspace modules and profile patches were present in `app.asar`. Electron Builder reported that platform-specific optional dependencies were not bundled because pnpm 11 does not install transitive platform binaries for the packaging project. The desktop manifest declared only macOS Sharp, Koffi, ripgrep, and native-addon packages.

## Decision

`apps/desktop/package.json` declares the Windows x64 Koffi, ripgrep, and `node-addon-require-builtin` variants alongside the macOS variants. Sharp already declares its own platform payloads transitively. `pnpm-workspace.yaml` lists macOS arm64/x64 and Windows x64 under `supportedArchitectures`, which makes pnpm install every required optional package before Electron Builder computes the dependency graph.

Windows cross-packaging uses `electron-builder --win nsis --x64 --config.npmRebuild=false` only when the required Windows prebuilds are available. Native compilation remains a Windows-runner responsibility when a prebuild is unavailable.

## Alternatives considered

**Let Electron Builder discover transitive platform packages.** Rejected because pnpm 11 deliberately does not install them for the packaging project, and Electron Builder reports the omission without failing the build.

**Rebuild every native dependency while cross-packaging.** Rejected because `node-gyp` does not support compiling Windows native modules from macOS. A Windows runner remains the fallback for dependencies without prebuilds.

## Consequences

The Windows installer contains the native modules required by the shipped profile and no longer relies on Electron Builder discovering transitive platform packages. macOS packaging retains its existing architecture-specific filtering. Release validation must inspect the target package's native files in addition to checking the workspace runtime closure.

## Verification

The Windows x64 NSIS package was rebuilt after adding the declarations. Electron Builder skipped dependency rebuild, packaged `app.asar`, and produced the installer successfully. The package's prebuilt `node-pty` Windows x64 binaries were present; the remaining platform packages are now declared for the packaging project.
