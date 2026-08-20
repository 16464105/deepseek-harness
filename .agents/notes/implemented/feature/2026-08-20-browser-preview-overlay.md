# Agent Note: Live browser preview overlay ships as a static dual-face package

Status: implemented

English | [中文](2026-08-20-browser-preview-overlay.zh.md)

## Problem

The browser tool suite (`@deepseek-ai/dsh-browser`) drives a persistent Playwright page, but the page's appearance is invisible to the human at the DSH UI: screenshots return to the model, never to the user's screen. Operators watching an agent work through a browser wanted a live preview of the page being driven — a floating window in the web client showing the current viewport, refreshing as the agent navigates and clicks.

An earlier prototype proved the concept as a **dynamic Cordis plugin** (defined per-session via `cordis_define`, Host half + `shell.overlay` occupant). That form cannot ship in the packaged desktop/web bundle: dynamic plugins live only in the defining process's memory and vanish on restart, so they cannot be distributed with the product.

## Decision

`@deepseek-ai/dsh-browser-popup` (package `packages/browser/browser-popup`) ships the preview as a **static dual-face package** registered in the web-app and desktop-app bundles, beside the `browser` row it depends on.

- **Host half** (`src/index.ts`): a `BrowserPopupService extends TypertRemoteService` providing `shot` (viewport PNG as byte-safe base64), `pageInfo` (url/title), and `navigate`. The typert generator emits `./remote` and `./typert` artifacts, and `packages/api/remotes` mounts the namespace so the web client sees `ctx.remote.browserPopup`.
- **Client half** (`src/client/`): one `shell.overlay` occupant (id `browser-popup`) — a React component polling `remote.browserPopup.shot()` every 1.5s while expanded, decoding the PNG through `createImageBitmap` and painting it on a canvas at native resolution (CSS scales for display). Collapsed it is a top-right pill; expanded it shows the live canvas, page title, and URL, with refresh / maximize / collapse controls. Errors render in the footer, never over the canvas.
- **Byte-safe base64**: the Host `btoa` builtin is UTF-8-only and corrupts bytes >= 0x80, which silently broke every PNG the first prototype produced. The package owns a byte-safe encoder (`bytesToBase64`) with a regression test.
- **Composition**: the base bundle carries the dependency; web-app and desktop-app patches `insert` the `browser-popup` row. Both bundle rows assume the `browser` tool suite is enabled (the overlay consumes `ctx.browser` through the Remote service).

## Alternatives considered

- **Ship the dynamic plugin as-is**: rejected — dynamic plugins are process-memory-only and cannot ride the packaged desktop/web bundle; sharing meant re-defining per session.
- **A `webServer` HTTP route serving the screenshot**: rejected — in the desktop shell the Electron frame intercepts unknown paths, so the route never answers; and the static form prefers the typert Remote channel that already carries Host→Client JSON.
- **`<img>` with `data:`/`blob:` URLs**: rejected — the desktop shell's CSP rejects both; `createImageBitmap` + canvas is the decode path that bypasses the `img-src` restriction.
- **Host `btoa`**: rejected — it is UTF-8-only; the byte-safe encoder is required for PNG bytes.

## Consequences

- The packaged web and desktop apps now ship the live browser preview; an operator watches the driven page update in the top-right overlay as the agent works.
- The preview is display-only: interacting with the page still goes through the agent's `browser_*` tools, not through the popup.
- The overlay is additive in `shell.overlay` (a list slot) — it never shadows shell chrome and is click-through until expanded.
- The screenshot rides the Remote channel as base64; a very large viewport yields a multi-hundred-KB message per poll (1.5s at 1280×720 ≈ 150 KB is acceptable; deployments with larger windows may lengthen `REFRESH_MS`).
- The package carries its own invariant companion (no runtime invariant: it owns no event/data relationship) and a host spec covering the base64 encoder.
