---
description: "Desktop deployment brand occupants for the sidebar, replacing the official artwork; for maintainers of the desktop fork choosing its brand presentation."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-brand-desktop

English | [中文](README.zh.md)

## Summary

This package gives the desktop deployment its own whale mark and product name in the sidebar. It registers below the official occupant's priority, so it wins the single-slot election without editing the official package, the shared locale dictionaries, or the brand primitives. Choose it for a build with its own identity; a deployment that ships upstream artwork simply leaves this row out. It has no runtime state and does not affect model requests.

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

Mount this plugin in the browser roster of a deployment whose identity differs from upstream's, as `dsh-desktop-app` does.

### Winning the election

`sidebar.brand.mark` and `sidebar.brand.name` are single slots: one occupant per priority, and the lowest priority renders. The official occupant registers at the default priority `0`, so this package registers at `-10` and shadows it. Both occupants install as one declaration-aware registration set, so the pair works whether this row activates before or after the sidebar's declaration.

### Keeping the shared dictionaries untouched

The sidebar renders its fallback name from the `brand.localBuild` locale key. Because the official occupant claims that slot in a desktop build, the fallback never renders, so this package carries the name as its own occupant instead of patching the shared dictionary.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The mark is the production wordmark vector rather than a raster rebuild, and it fills with the brand blue so the sidebar, hero, favicon, and Electron icons share one color. The browser half is [`src/client/index.ts`](src/client/index.ts) with its artwork in [`src/client/Brand.tsx`](src/client/Brand.tsx); the node half is an empty Loader seat. The browser title is a build-environment concern (`DSH_CLIENT_TITLE`), outside the slot system.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the brand surface is not enough.

- [ui-sidebar](../ui-sidebar/README.md) — declares `sidebar.brand.mark` and `sidebar.brand.name` and renders their fallbacks.
- [ui-brand-official](../ui-brand-official/README.md) — the upstream occupant this package shadows.
- [Slots reference](../../../docs/subsystems/slots.md) — the single-slot election rule this package relies on.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the sidebar and hero slots it occupies, which change only rendered artwork; the package registers no prompt, schema, or result of its own.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define how brand presentation is supplied. They are current package constraints, not a task backlog.

- **The conversation hero keeps its own fallback** — `conversation.hero.brand.mark` stays on the declaring package's animated fish, so this package occupies the sidebar only.
- **The browser title is independent** — `DSH_CLIENT_TITLE` selects title text at build time rather than through a UI slot.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The package retains no mutable state, and its two slot occupants install and leave through one transactional effect.
