---
description: "The desktop Skills management page over the session skill catalog; for users managing local Skills and maintainers of the desktop fork."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-settings-skill

English | [中文](README.zh.md)

## Summary

This package gives the Settings surface a Skills page: it lists the current session's skill catalog, filters it, toggles each skill's visibility in the chat command picker, and reveals or opens the user skills directory on the host desktop. Choose it for a deployment that wants skill management in Settings; upstream's `ui-skill` owns the chat picker alone and ships no management page. It reads the catalog through the skills Remote and does not affect model requests.

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

Mount this plugin in the browser roster of a deployment whose Settings surface should manage Skills, as `dsh-desktop-app` does.

### What the page offers

The page lists every skill the current session's catalog returns, with its description, provider, and source. A search field filters by name, description, or provider. Each row carries a chat-picker visibility toggle, persisted in the browser so the picker and the page agree. A refresh gesture re-reads every provider, which is what makes a skill file added outside the app appear without a restart.

### Opening the skills directory

The host reports the absolute user skills directory and whether it can open a path natively. On a desktop host the page offers an open action; elsewhere it reveals the path as text so a person can copy it. Both the directory and the open gesture belong to the host, not this package.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The page registers one `settings.section` occupant under the `settings.skill` locale namespace. `SkillVisibility` owns the picker selection as a browser-local persisted set behind an external-store snapshot, so the page and the picker read one source. `SkillsDirectoryStore` owns the directory facts and the in-flight open action. The catalog read passes the refresh through to the skills Remote, whose host side re-reads providers instead of serving a cached observation. The browser half is [`src/client/index.ts`](src/client/index.ts); the node half is an empty Loader seat.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the Skills surface is not enough.

- [ui-skill](../ui-skill/README.md) — the chat command picker this page's visibility choice feeds.
- [ui-settings](../ui-settings/README.md) — declares the `settings.section` slot this page occupies.
- [ui-settings-mcp](../ui-settings-mcp/README.md) — the sibling management page for MCP servers.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the chat command picker's visibility choice it shares with ui-skill: hiding a skill removes it from the picker's candidates, so the model is never offered it.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define how skill management is supplied. They are current package constraints, not a task backlog.

- **Visibility is browser-local** — the picker selection persists in `localStorage`, so it does not follow a person across browsers or hosts.
- **The catalog is read-only here** — the page manages visibility and reveals the directory; it does not create, edit, or delete skill files.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The page owns browser-local presentation state only, and its registration leaves with its plugin fiber.
