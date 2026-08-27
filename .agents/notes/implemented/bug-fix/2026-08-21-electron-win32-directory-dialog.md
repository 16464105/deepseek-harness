# Agent Note: Packaged desktop uses Electron's Win32 directory chooser

Status: implemented

English | [中文](2026-08-21-electron-win32-directory-dialog.zh.md)

## Problem

Selecting a workspace in the packaged Windows desktop surfaced `win32 folder dialog worker exited before reporting a result`. The native picker spawned `process.execPath` with `ELECTRON_RUN_AS_NODE=1` to run `lib/worker.cjs`. That child cannot load the worker from `app.asar`, so the packager rewrites the entry into `app.asar.unpacked`. The child's `require('koffi')` then walks from the unpacked entry back toward `node_modules`, misses the archive-resident package (the same class of gap as [asar nested ESM imports](2026-08-21-asar-fallback-nested-esm-imports.md)), and exits without an IPC result. The spawn also inherited stderr instead of piping it, so the Host error carried no worker diagnostic. The [koffi child-process picker](../feature/2026-08-02-win32-in-process-folder-dialog.md) remains the Node Windows tier; it was never designed for an Electron archive.

## Decision

`pickNativeDirectory` on `win32` uses Electron's `dialog.showOpenDialog` whenever `process.versions.electron` is set (the packaged desktop Host runs in the main process). The koffi child stays the only native tier on plain Node Windows. The worker spawn pipes stderr so a silent child death still attaches the real failure. Desktop `asarUnpack` matches nested layouts with `**/dsh-host-directory-picker-native/lib/**` and `**/koffi/**` so a non-Electron packaged Host can still load the worker and its native bindings.

## Alternatives considered

**Keep repairing the koffi child for packaged Electron (asar unpack plus a resolve hook in the worker).** Rejected because Electron already owns a main-process directory chooser; another archive-escape path for one dialog is a second copy of the [asar fallback](2026-08-21-asar-fallback-nested-esm-imports.md) problem.

**Fall back to the browse dialog after the worker exits.** Rejected because a local desktop operator should get the OS folder picker, and a silent child death is a packaging defect, not a missing-tool case.

**NSIS as the only Windows package from macOS.** Rejected: `makensis` needs Wine on a non-Windows host. The zip target produces `DeepSeek Harness.exe` without Wine; NSIS stays a Windows-runner (or Wine) command.

## Consequences

Workspace folder pick on the packaged Windows desktop no longer depends on a spawned asar worker. Plain Node Windows is unchanged. Cross-packaging from macOS emits a zip unless Wine is present for NSIS.

## Verification

`packages/host/directory-picker-native/tests/electron-dialog.spec.ts` covers abort, cancel, empty paths, and focused-window parenting against a fake Electron API. `native-picker.spec.ts` pins the Electron-vs-koffi fork. Worker stderr attachment stays in `win32-dialog.spec.ts`.
