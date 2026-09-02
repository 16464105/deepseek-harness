---
description: "Model-facing browser-operation tools driving one persistent local Chromium through Playwright."
kind: "package-reference"
---

# @deepseek-ai/dsh-browser

English | [中文](README.zh.md)

## Summary

Model-facing browser-operation tools driving one persistent local Chromium through [Playwright](https://playwright.dev). The package owns the complete tool suite — `browser_navigate`, `browser_click`, `browser_type`, `browser_press_key`, `browser_snapshot`, `browser_screenshot` — their schemas, the pinned model-facing prose, the `aria-ref` interaction contract, engine selection, and the attachments-conditional screenshot path. The Playwright session lives behind the private `BrowserController` service; no other package reads it, so the capability ships as one plugin without a public seam ([rationale](../../../.agents/notes/implemented/feature/2026-08-16-browser-tools.md)).

The tools model the Playwright `mode: 'ai'` accessibility snapshot loop: `browser_snapshot` returns the page's aria snapshot YAML with `[ref=eN]` markers, and `browser_click`/`browser_type` address elements by those refs. A ref absent from the last snapshot is rejected before any browser interaction, so a stale reference fails with a model-readable error instead of clicking the wrong element.

## Table of Contents

- [Tools](#tools)
- [Model Experience](#model-experience)
- [Dev Note](#dev-note)

-----

## Tools

| Tool | Args | Behavior |
|---|---|---|
| `browser_navigate` | `url` (string) | Loads an absolute http(s) URL into the persistent page. |
| `browser_snapshot` | — | Returns the aria snapshot with `[ref]` markers, plus the page URL and title. |
| `browser_click` | `ref` (string) | Clicks the element referenced by a ref from the last snapshot. |
| `browser_type` | `ref` (string), `text` (string) | Replaces the referenced text field's content with `text`. |
| `browser_press_key` | `key` (string), `modifiers` (string[]) | Presses a key, optionally holding `Control`/`Meta`/`Shift`/`Alt`. |
| `browser_screenshot` | — | Captures the viewport as a PNG image block (image-capable routes only). |

Every tool except `browser_snapshot` declares `isConcurrencySafe: () => false`: they mutate one shared page, so sibling tool calls never interleave on it. `browser_screenshot` registers only while a durable attachment store is mounted (`ctx.attachments`), because its image block must reference a committed attachment; the same gate exists in the execute body for direct callers.

## Config

| Key | Default | Meaning |
|---|---|---|
| `engine` | `chromium` | Browser engine: `chromium` (the Playwright-managed Chromium) or `chrome` (the host Chrome/Chromium installation via the `chrome` launch channel). |
| `headless` | `true` | Launch without a visible window. |

```yaml
- id: browser
  name: '@deepseek-ai/dsh-browser'
  disabled: false
```

The browser process starts on first use, not at plugin load; disposing the plugin closes browser, context, and page, so a reload leaves no orphan process. A missing binary surfaces as the structured `NO_BROWSER` failure with an actionable message (the `chrome` engine names the `chromium` fallback).

## Engine and browser installation

Playwright 1.61.1 is a direct dependency. A deployment that stays on the default `chromium` engine must install the browser binary once (`pnpm exec playwright install chromium`, or `--with-deps` on Linux); Playwright otherwise reports the missing executable at first use, translated to the `NO_BROWSER` error. The `chrome` engine needs no download where a Chrome/Chromium installation exists on the host.

## Error taxonomy

All browser failures reach the tool pipeline as `BrowserError` — the closed code set is `NO_BROWSER` (engine cannot launch), `NO_PAGE` (page closed or crashed), `STALE_REF` (locator mismatch), `BAD_TARGET` (non-http(s) or credentialed URL), and `BROWSER_FAILURE` (anything else). The registry exposes the code in structured error metadata, so policy and hooks route on it without parsing model-visible text.

-----

<a id="dev-note"></a>
## Dev Note

The Playwright session lives behind the private `BrowserController` service; no other package reads it, so the capability ships as one plugin without a public seam. Engine selection (`chromium` vs `chrome`) and headless mode are configuration fields; the Playwright Chromium install is a development and CI prerequisite and the package never downloads a browser at runtime.

## Model Experience

### System prompt

#### What the model sees

One guidance section (`tool:browser`) registered beside the tools:

##### Browser guidance

```markdown
The browser tools drive one persistent Chromium page. Use browser_navigate to open an http(s) URL, then browser_snapshot to get the accessibility tree with [ref] markers; interact via browser_click/browser_type/browser_press_key using refs from the last snapshot. Re-run browser_snapshot before acting on elements that may have changed. browser_screenshot returns a viewport PNG to the model when the current model route declares image input.
```

#### Token effect

Fixed guidance cost per request while the plugin is mounted. A scoped tool restriction does not remove this independently registered section.

#### KV Cache effect

Prefix-stable while the plugin stays mounted and the guidance text is unchanged. Mounting or unmounting the plugin invalidates reuse from the first changed prompt section.

### Tool schemas

#### What the model sees

The generated [tool catalog](../../../docs/tool-catalog.md#deepseek-aidsh-browser) lists all six schemas. Engine selection never changes them; `browser_screenshot` is absent only when no attachment store is mounted.

#### Token effect

Fixed schema cost per registered tool. Mounting the plugin without an attachment store omits one schema; scoped restrictions remove schemas independently.

#### KV Cache effect

Prefix-stable while definitions and visibility are unchanged. Plugin lifecycle, attachment-store presence, or scoped restrictions invalidate reuse from the first changed schema token.

### Snapshot result

#### What the model sees

Exactly `<url>…</url>`, `<title>…</title>`, and the aria snapshot YAML inside `<aria-snapshot>…</aria-snapshot>`, then the standing instruction `Use [ref] values from this snapshot in browser_click and browser_type. Re-run browser_snapshot after actions that change the page.` Snapshots over 200,000 characters are cut and flagged.

#### Token effect

Data-dependent page content, resent until compaction.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix.

### Screenshot result

#### What the model sees

An image block (committed attachment) beside the text envelope `image/png image, <width>x<height> px, <bytes> bytes`. Execution refuses unless the routed model declares image input, mirroring `read_image`.

#### Token effect

One image per call; the PNG bytes ride an attachment reference, not inline tokens.

#### KV Cache effect

Independent image attachment; the text envelope is append-only.

### Action results and errors

#### What the model sees

Successful actions return `Navigated to <url>`, `Clicked element <ref>. Run browser_snapshot to see the updated page.`, `Typed into element <ref>. …`, or `Pressed <key>. …`. Failures become `Error: <message>` with the structured code above.

#### Token effect

Only the failing or acting call adds these retained tokens.

#### KV Cache effect

Append-only; newly visible content follows the reusable request prefix.

## Known Limitations and Deferred Work

- **Browser-scoped navigation policy is deferred** — `browser_navigate` accepts any http(s) URL the model supplies; the package defines no domain allow/deny policy, and a deployment that needs one adds a `tools/pre-execute` guard. The URL validation in this package covers only scheme and embedded credentials.
- **One page, one browser** — the plugin keeps a single page in a single Chromium; tab management, multiple concurrent pages, and multi-step scripted flows are out of scope. Re-launching after a page crash requires a fresh `browser_navigate`.
- **No remote-browser provider** — the Playwright engine drives a local process; a remote/browserless deployment needs a separate provider and is not supported by this package.
