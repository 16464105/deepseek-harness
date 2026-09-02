---
description: "Live browser preview overlay for the DSH web client: shows the model-driven Playwright page in a floating top-right popup."
kind: "package-reference"
---

# @deepseek-ai/dsh-browser-popup

English | [中文](README.zh.md)

## Summary

Live browser preview overlay for the DSH web client: shows the model-driven Playwright page in a floating top-right popup, refreshed every 1.5 seconds. The Host half exposes a Remote service (`browserPopup`) with `shot` (binary-safe base64 screenshot), `pageInfo` (url/title), and `navigate`; the Client half occupies the `shell.overlay` slot and renders the screenshot on a canvas at native resolution (CSS scales for display).

The overlay is additive: it contributes one entry to the frame-wide `shell.overlay` list slot, never replaces shell chrome, and is click-through until expanded. It ships beside the `browser` tool suite (same `browser` service dependency) and only makes sense where the browser is enabled.

## Table of Contents

- [Remote surface](#remote-surface)
- [Client overlay](#client-overlay)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="remote-surface"></a>
## Remote surface

| Method | Returns | Behavior |
|---|---|---|
| `shot` | `BrowserShotResult` | Captures the current page viewport as a base64 PNG (`png`, `byteLen`, `b64Len`). |
| `pageInfo` | `BrowserPageInfoResult` | Returns the current page URL and title. |
| `navigate` | `BrowserNavigateResult` | Navigates the persistent page to an absolute http(s) URL. |

Every method resolves the browser service lazily and returns `{ ok: false, error }` when the browser is unavailable, so the overlay degrades to an error string instead of failing the Remote call.

<a id="client-overlay"></a>
## Client overlay

The Client half registers one occupant of the `shell.overlay` slot. The session-header toggle shows or hides it; the close button hides it entirely, so nothing renders until the header action is clicked. Screenshots render on a canvas at native resolution, CSS-scaled for display.

<a id="model-experience"></a>
-----

<a id="dev-note"></a>
## Dev Note

The overlay depends on the `browser` service being mounted and a Playwright Chromium install being present; without either it renders its error state instead of failing the Remote call.

<a id="known-limitations-and-deferred-work"></a>

## Model Experience

### The preview overlay

#### What the model sees

The overlay is presentation-only: it never contributes tokens to a model request, never appears in the session log, and does not alter the model-visible tool surface. It renders the same Playwright page the `browser_*` tools drive, refreshed on a fixed interval, so a human watches the model's navigation without any change to the conversation transcript.

#### Token effect

Zero tokens. The overlay adds no prompt content, tool schemas, or event log rows.

#### KV Cache effect

None. The overlay holds no model-visible state and writes nothing the cache reads.

## Known Limitations and Deferred Work

- **Fixed refresh interval** — the overlay re-screenshots on a fixed 1.5s cadence; live video-like streaming and per-frame diffs are out of scope.
- **Single browser page** — the overlay shows the one persistent Playwright page the browser tool suite drives; multiple pages or tabs are not previewed.
