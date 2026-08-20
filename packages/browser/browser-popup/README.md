# @deepseek-ai/dsh-browser-popup

English | [中文](README.zh.md)

Live browser preview overlay for the DSH web client: shows the model-driven Playwright page in a floating top-right popup, refreshed every 1.5 seconds. The Host half exposes a Remote service (`browserPopup`) with `shot` (binary-safe base64 screenshot), `pageInfo` (url/title), and `navigate`; the Client half occupies the `shell.overlay` slot and renders the screenshot on a canvas at native resolution (CSS scales for display).

The overlay is additive: it contributes one entry to the frame-wide `shell.overlay` list slot, never replaces shell chrome, and is click-through until expanded. It ships beside the `browser` tool suite (same `browser` service dependency) and only makes sense where the browser is enabled.

## Remote surface

| Method | Returns | Behavior |
|---|---|---|
| `shot` | `BrowserShotResult` | Captures the current page viewport as a base64 PNG (`png`, `byteLen`, `b64Len`). |
| `pageInfo` | `BrowserPageInfoResult` | Returns the current page URL and title. |
| `navigate` | `BrowserNavigateResult` | Navigates the persistent page to an absolute http(s) URL. |

Every method resolves the browser service lazily and returns `{ ok: false, error }` when the browser is unavailable, so the overlay degrades to an error string instead of failing the Remote call.

## Client overlay

The occupant (`browser-popup` in `shell.overlay`) polls `remote.browserPopup.shot()` while expanded:

- Collapsed state is a small pill in the top-right corner (click to expand).
- Expanded state shows the live canvas (native resolution, CSS-scaled to fit), the page title, and the current URL.
- `⟳` forces a refresh; `⛶`/`⤡` toggles near-fullscreen (92vw × 90vh); `✕` collapses back to the pill.
- Errors (decode failure, Remote failure, browser unavailable) render in the footer, never over the canvas.

## Composition

```yaml
# web-app bundle: enable the browser suite and add the overlay beside it.
- id: browser
  disabled: false
- insert:
    - id: browser-popup
      name: '@deepseek-ai/dsh-browser-popup'
```

The package is dual-face: the node half is the `browserPopup` Remote service (typert-generated `./remote` client), the browser half is the `shell.overlay` occupant. Both halves require the `browser` service from `@deepseek-ai/dsh-browser`, so the bundle rows above assume the browser tool suite is enabled.

## Known limitations

- The screenshot rides the typert Remote channel as base64; a large viewport yields a multi-hundred-KB message per poll. The 1.5s interval keeps the pipeline light at 1280×720 (~150 KB), but deployments with very large windows may prefer a longer `REFRESH_MS`.
- The overlay is display-only: interacting with the driven page still goes through the agent's `browser_*` tools, not through the popup.
