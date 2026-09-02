# Agent Note: Packaged plugin tree loads through derived-cache discard and public exports

Status: implemented

English | [中文](2026-09-02-packaged-plugin-tree-load.zh.md)

## Problem

The packaged desktop Host applies the plugin tree as one include. Any loader entry that refuses to import or init fails the include, so the application never reaches a window. Three independent refusals share that path: a `session_projcache` row whose identity no longer matches `checkpointIdentity` fails domain open with `invalid-record`; `dsh-llm-tencent-codebuddy` imports `@deepseek-ai/dsh-llm-pi-ai/src/*.ts`, which the asar package does not ship; and `dsh-better-sidebar@0.13.1` imports `settingsNamespace` from `@deepseek-ai/dsh-settings`, which the settings package did not export. The first refusal contradicts the projection-cache contract that a stale or unreadable cache costs a longer tail replay, never a refused boot ([per-session files](../architecture/2026-08-19-projection-cache-per-session-files.md)). The second refusal is a packaged-runtime import of a workspace source path. The third refusal is a shipped desktop plugin calling a missing public helper.

## Decision

`DomainFacility.open` omits a `per-record` table row that fails its zod schema, logs one warning naming the domain, table, and key, and continues. A `single`-layout record or any global that fails still rejects the open with `invalid-record`. The json backend already reads a malformed or differently versioned per-record document as absent; domain open now applies the same discard to a version-matching document whose value drifted.

`@deepseek-ai/dsh-llm-pi-ai` exports `resolveProfiles`, `authContextFrom`, and `credentialStoreFrom` from the package root. `dsh-llm-tencent-codebuddy` imports those helpers from that root, which the packaged `lib/index.js` graph can resolve.

`settingsNamespace(value)` is the public runtime brand-and-validate helper for a dynamic settings namespace. `register` still type-checks a string literal; the helper is what a plugin uses when the namespace is a constant or other non-literal string.

## Alternatives considered

**Bump `session_projcache` version so the json backend discards every existing row.** Rejected as the only fix: a later required-field addition that forgot another bump would brick boot the same way. Version stamps remain the way a schema owner discards a whole generation; they do not replace per-row schema discard.

**Catch the cache open failure inside `SessionProjectionCache` and run without a domain.** Rejected because every derived per-record domain would re-implement the same catch, and the facility is already the place that classifies open-time record damage.

**Ship `dsh-llm-pi-ai` `src/` inside the asar and load TypeScript at runtime.** Rejected because the packaged Host runs built `lib/` under plain Node and has no TypeScript loader. The `./src/*` export stays a workspace source-launch path.

**Bump the desktop pin of `dsh-better-sidebar` to the alpha line that stopped importing `settingsNamespace`.** Deferred: the desktop profile still ships `0.13.1`, and the helper is the correct public API for a dynamic namespace even after that pin moves.

**Make the include fail-soft on any plugin refusal.** Rejected because it would hide a first-party load failure behind a half-mounted tree.

## Consequences

A schema-drifted projection-cache row no longer refuses Host boot; that session loses its listing shortcut until the next checkpoint. A sibling adapter that reuses pi-ai transport must import the package root, not a `src/` subpath. Packaged desktop can load `dsh-better-sidebar@0.13.1` against the current settings package. Authoritative `single`-layout domains such as `workspace` still fail loud on a bad record.

## Verification

`packages/storage/storage-domain/tests/domain.spec.ts` opens a `per-record` domain that holds one valid row and one schema-invalid row, serves the valid row, omits the invalid row, and still rejects a schema-invalid global. The same file keeps the `single`-layout `invalid-record` refusal. `packages/llm/llm-pi-ai/tests/adapter.spec.ts` asserts the package-root re-exports. `packages/llm/llm-tencent-codebuddy/tests/provider-wiring.spec.ts` refuses a `src/` import of `dsh-llm-pi-ai`. `packages/settings/settings/tests/settings.spec.ts` brands a valid namespace and rejects an invalid one through `settingsNamespace`.
