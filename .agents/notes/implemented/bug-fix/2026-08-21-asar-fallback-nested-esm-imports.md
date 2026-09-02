# Agent Note: Out-of-tree plugins resolve in-box peers from an Electron archive

Status: implemented

English | [中文](2026-08-21-asar-fallback-nested-esm-imports.zh.md)

## Problem

A packaged desktop Host loads an out-of-tree profile plugin from `$DSH_HOME/profiles/<name>/node_modules`. That module's nested `import` of an in-box peer such as `@deepseek-ai/dsh-tools` walks to `$DSH_HOME/profiles/node_modules`, whose healer symlink points into `app.asar`. Node's ESM `getPackageJSONURL` does not treat the symlink path as an archive member (the path has no `.asar` segment until the link is followed, and the archive is a file), so startup fails with `ERR_MODULE_NOT_FOUND` after the user installs a community bundle. Loader `resolveImport` already converts the config row's own bare name to an installation `file:` URL; it does not run for imports inside that file. The [desktop packaging decision](../feature/2026-08-16-electron-desktop-tencent-codebuddy.md) keeps JavaScript inside the archive and unpacks only native binaries.

## Decision

`boot` / `mountRootInclude` install `installInstallationResolveHook(bareModuleBaseUrl)` whenever a closed runtime names that base. The hook is a process-wide `module.registerHooks` resolve fallback: a failed bare specifier retries `createRequire(installAnchor).resolve()`, which Electron can answer inside `app.asar`, and returns a `file:` URL that contains `.asar` so the subsequent load uses the same archive path in-box plugins already use. A later `boot` only replaces the require; Node without `registerHooks` is a no-op unless the anchor itself names an `.asar` path, which then fails loud. Relative, absolute, and scheme specifiers are never retried.

## Alternatives considered

**Unpack `node_modules/**` into `app.asar.unpacked` and retarget healer links.** Rejected because the desktop packaging decision unpacks only native binaries; unpacking the whole closure would change signing, Gatekeeper scan cost, and the archive layout every in-box import already uses.

**Extract each asar package onto disk at heal time.** Rejected because it duplicates the installation under `$DSH_HOME`, must invalidate on every app update, and turns healer entries into real directories, which the healer already rejects.

**Rewrite fallback `package.json` `exports` to absolute asar `file:` URLs.** Rejected because Node requires `exports` targets to be `./`-relative, and a generated shim cannot cover every subpath export.

## Consequences

An out-of-tree desktop plugin can import any package in the installation closure without a profile-local copy. Source launches and hosts that omit `bareModuleBaseUrl` are unchanged. The hook is process-global, so tests that need a missing peer must run before it is installed or use a name the installation cannot resolve. Packaged desktop still does not unpack JavaScript packages. A later change also heals `$DSH_HOME/profiles/node_modules` with ESM proxies when the install anchor names an `app.asar` path ([asar module fallback proxies](2026-09-02-asar-module-fallback-proxies.md)), so roster health and other symlink-path `existsSync` callers see ordinary package directories; the hook remains for nested imports that still miss through the parent walk.

## Verification

`packages/boot/app-boot/tests/installation-resolve-hook.spec.ts` stages a unique installation-only peer and a sibling plugin directory. An in-process import fails before the hook. A child `node --import tsx/esm` process that calls `installInstallationResolveHook` then imports the plugin succeeds, and the same child still fails for a name neither tree contains. The child is required because Vitest's module runner does not invoke `module.registerHooks`.
