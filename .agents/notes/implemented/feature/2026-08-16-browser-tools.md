# Agent Note: Browser operation ships as one Playwright-backed tool plugin

Status: implemented

English | [中文](2026-08-16-browser-tools.zh.md)

## Problem

The harness had no way for the model to operate a real web browser: no navigation, no clicks, no form filling, no page reading. The web capability (`ctx.web`) covers only server-side search and fetch — it cannot run client-side JavaScript, fill fields, or observe rendered state. The model could only delegate such work to shell scripting with no browser automation installed.

Adding the capability raises three design questions the codebase conventions answer at once: whether it needs a public capability seam (Service Definition / Provider / Consumer), which engine to drive, and how the model addresses page elements reliably.

## Decision

Browser operation ships as one plugin, `@deepseek-ai/dsh-browser` (package `packages/browser/browser`), combining all three roles. The Playwright session lives behind a private `BrowserController` service (`ctx.browser`) — no other package reads it, so a public seam with provider registry and selection would carry one provider and one consumer and nothing else; the package rules reject a public service with one internal caller.

The tools drive one persistent Chromium through Playwright 1.61.1 (direct dependency, pinned), modeling the Playwright `mode: 'ai'` accessibility snapshot loop:

- `browser_navigate` loads an absolute http(s) URL into the persistent page.
- `browser_snapshot` returns the page's aria snapshot YAML with `[ref=eN]` markers, plus URL and title.
- `browser_click` and `browser_type` address elements by those refs; a ref absent from the last snapshot is rejected before any browser interaction (`STALE_REF`).
- `browser_press_key` presses a key with optional `Control`/`Meta`/`Shift`/`Alt` modifiers.
- `browser_screenshot` captures the viewport as a PNG image block, mirroring `read_image`: it registers only while a durable attachment store is mounted and refuses execution unless the routed model declares image input.

Engine selection is one config knob: `engine: chromium` (default, the Playwright-managed Chromium) or `chrome` (the host Chrome installation through the `chrome` launch channel). Launching is lazy — the browser process starts on first use and closes on plugin dispose. All failures reach the tool pipeline as a closed `BrowserError` taxonomy (`NO_BROWSER`, `NO_PAGE`, `STALE_REF`, `BAD_TARGET`, `BROWSER_FAILURE`).

Composition policy: the base bundle mounts the `browser` row **disabled** so no default composition launches Chromium; the web-app bundle enables the row, making the tools web/desktop-plane only. Headless/CLI deployments enable them with a one-line patch override.

## Alternatives considered

- **A capability seam like `ctx.web`** (Service Definition in one package, a Playwright provider in another, a `tool-browser` consumer in a third): rejected — one engine and one consumer today; the seam would exist for hypothetical remote-browser providers, and the package rules require a current owner and need for every abstraction.
- **CDP over a shell `chromium` command**: rejected — hand-rolling the DevTools protocol duplicates what Playwright already owns (locators, aria snapshots, lifecycle), and Playwright is already in the dependency graph (1.61.1 via the web frontend's test tooling).
- **Puppeteer instead of Playwright**: rejected — the repository already pins Playwright 1.61.1, and its `ariaSnapshot({ mode: 'ai' })` + `aria-ref` locator pair is the exact model-interaction contract this feature wants.
- **CSS selectors as the model-facing element address**: rejected — the model cannot invent stable CSS selectors, and Playwright's accessibility snapshot emits refs designed for this loop.
- **Registering `browser_screenshot` unconditionally**: rejected — its image block must reference a committed attachment, so the registration gate follows `read_image`'s attachments-conditional pattern.

## Consequences

- The model gains a real browser: navigate, read accessibility snapshots, click, type, press keys, and capture screenshots on one persistent page, without delegating to shell.
- The browser tools are web-plane by default; the base row ships disabled, and the enabled/disabled split is a one-line patch per deployment.
- Every mutation tool declares concurrency-unsafe, so the shared page never receives interleaved sibling calls.
- A deployment on the default engine must install the Playwright Chromium binary once; a missing binary surfaces as the actionable `NO_BROWSER` error.
- The snapshot scenario in `examples/headless-agent/tests/browser.snapshot.ts` runs the real Chromium under the keyless mock adapter and self-skips when no browser binary exists.
