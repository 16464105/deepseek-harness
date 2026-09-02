# Agent Note: Desktop window loads the process launch token

Status: implemented

English | [中文](2026-09-02-desktop-window-launch-token.zh.md)

## Problem

The packaged desktop Host and the `dsh web` Host share Connection's browser-session gate: `GET /` without a process launch token or a valid signed cookie returns `401` with `dsh web authentication required; reopen the URL printed by dsh web.` After the plugin tree started applying, the Electron window loaded the bare loopback origin on a random port. Desktop binds `port: 0`, so a cookie from an earlier process cannot match the new authority, and the desktop profile does not print a URL the operator can reopen. The first navigation therefore always received that 401. The same process still inherited `dsh-web-app`'s default `openBrowser: true`, so the system browser could receive the authenticated URL while the native window did not.

## Decision

The desktop main process builds the window URL with `connection.authenticatedUrl` for `http://127.0.0.1:<port>` and uses that URL for the first load and for later window recreation. The desktop patch sets `openBrowser: false` so the process does not also hand the launch token to the system browser. The 401 text remains the shared Connection diagnostic; desktop never prints that URL.

## Alternatives considered

**Disable browser-session authentication in the desktop profile.** Rejected because the renderer still uses the loopback HTTP carrier, and the [launch-token decision](../architecture/2026-08-24-browser-token-authentication.md) authenticates every Host API on that carrier. A second unauthenticated desktop path would restore the gap that decision closed.

**Keep a durable desktop cookie authority on a fixed port.** Rejected because the desktop profile binds an ephemeral port so two copies do not collide, and cookie names are authority-bound. A fixed port would still require the first navigation to present the process token when no cookie exists.

**Leave system-browser handoff enabled so an operator can recover from the 401.** Rejected because desktop already owns a window, and opening the launch-token URL in the default browser writes a process credential into that browser's history.

## Consequences

A packaged or source-launched desktop window can complete the same token-to-cookie exchange `dsh web` uses. The launch token stays inside the Electron session. An operator who opens the bare loopback origin in another browser still receives the shared 401; that is the intended refusal, not a recovery path.

## Verification

`apps/desktop/tests/navigation.spec.ts` asserts `authenticatedApplicationUrl` asks Connection to authenticate `http://127.0.0.1:<port>`. `packages/bundle/desktop-app/tests/desktop-app.spec.ts` pins `openBrowser: false` on the composed `web-runtime` row.
