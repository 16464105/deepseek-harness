# Agent Note: Electron asar installations heal with ESM module proxies

Status: implemented

English | [中文](2026-09-02-asar-module-fallback-proxies.zh.md)

## Problem

Packaged desktop healed `$DSH_HOME/profiles/node_modules` with OS symlinks into `app.asar` because `isPackagedExecutable` only recognized pkg's `process.pkg`. Electron can import those packages through `createRequire(installAnchor)` and the [asar nested-import hook](2026-08-21-asar-fallback-nested-esm-imports.md), so the Host boots. Preset health does not: `packageInstalled` walks `existsSync(.../node_modules/<pkg>/package.json)` from the profile base, and Electron's asar filesystem answers `false` for that path when it still names the symlink rather than a path containing `.asar`. Every shipped preset therefore listed as broken with many "names a plugin that cannot be resolved" rows, even while those same plugins were already mounted.

## Decision

`healProfilesModuleFallback` writes ESM proxies whenever the install anchor names an `.asar` path, the same carrier already used for pkg's `/snapshot`. A later launch replaces stale asar symlinks with proxies. Preset health then sees a real on-disk `package.json` under the profiles fallback, matching Node's ordinary parent walk.

## Alternatives considered

**Teach `packageInstalled` to `readlink` and `existsSync` the asar target.** Rejected as the only fix: roster health would recover, but every other `existsSync`/`stat` caller that walks the healed symlink path would keep the same false negative, and the heal would still leave a carrier the asar nested-import note already treats as hostile.

**Unpack JavaScript packages into `app.asar.unpacked` so symlinks land on ordinary files.** Rejected because the desktop packaging decision unpacks only native binaries; changing that layout affects signing and archive size for every in-box import.

**Skip resolve-based preset health inside Electron.** Rejected because `broken` drives picker filtering and mount refusal; silencing it would reintroduce healthy cards for compositions that cannot start.

## Consequences

A packaged desktop launch rewrites the shared profiles module fallback to proxies and marks shipped presets healthy when their rows resolve in the asar installation. Source launches and plain Node installs keep symlinks. The asar nested-import resolve hook remains for out-of-tree modules whose own imports still need the install-anchor fallback.

## Verification

`packages/boot/app-boot/tests/profile.spec.ts` stages an install anchor under a path containing `app.asar`, seeds a stale symlink in the profiles fallback, heals, and asserts the entry is a proxy directory whose `package.json` exists and whose entry module imports.
