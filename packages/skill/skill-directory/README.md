---
description: "A Remote surface that reports and opens the user skills directory on the host; for deployments whose client offers a Skills management page."
kind: "package-reference"
---

# @deepseek-ai/dsh-skill-directory

English | [中文](README.zh.md)

## Summary

This package exposes the user skills directory to the browser client: the absolute path, whether the host can open it natively, and one open action. It is the same harness-home root the root `dsh-skill-filesystem` provider scans as `user-dsh`, so the surface opens exactly where discovered user skills come from. Mount it where a client offers a Skills management page; a deployment without one does not need it. It registers no model-facing tool.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount this plugin in the host roster of a deployment whose client reveals or opens the user skills directory, as `dsh-desktop-app` does.

### What the surface offers

`remote.skillDirectory.info()` returns the absolute directory and whether this host has a native opener. `remote.skillDirectory.open()` asks the host to open it. Both create the directory when it is absent: a home whose person never installed a user skill has no directory yet, and the macOS opener fails on a missing target, so a reveal action would otherwise always error on a fresh home.

### When no opener exists

A headless or remote host reports `canOpenPath: false` and `open()` returns `{ opened: false, path }` instead of failing. A client uses that to reveal the path as text rather than offering an action that cannot work.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The service is a `TypertRemoteService` named `skillDirectory`; the generated Remote contribution ships through `exports["./remote"]`, and the browser client mounts it the way any other package does. The directory path is one function, so the reported path and the opened path cannot diverge. The host half is [`src/index.ts`](src/index.ts) and its wire types are in [`src/types.ts`](src/types.ts).

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the directory surface is not enough.

- [skill-filesystem](../skill-filesystem/README.md) — the provider that discovers skills from the same harness-home root.
- [skill](../skill/README.md) — the registry whose catalog the directory feeds.
- [ui-settings-skill](../../client/ui-settings-skill/README.md) — the Settings page that consumes this surface.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the skills the filesystem provider discovers from the directory it reports: a skill a person drops there becomes available to the catalog. This package registers no prompt, schema, or result of its own.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define how the directory surface is supplied. They are current package constraints, not a task backlog.

- **One fixed root** — the directory is the harness-home `skills` root, matching the provider that discovers from it; it is not configurable here.
- **Opening is best-effort** — the surface reports whether the host opened the directory, not whether a person saw it.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The service holds no state beyond the harness home it resolves per call, and its Remote namespace leaves with its plugin fiber.
