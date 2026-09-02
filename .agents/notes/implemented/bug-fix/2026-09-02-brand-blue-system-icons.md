# Agent Note: System icons use DeepSeek brand blue

Status: implemented

English | [中文](2026-09-02-brand-blue-system-icons.zh.md)

## Problem

`apps/web/public/favicon.svg` painted the DeepSeek whale black and switched to white under `prefers-color-scheme: dark`. Electron Builder derived every desktop application icon from that SVG, so the Dock and Windows shell received a black mark on a transparent canvas that reads poorly against dark desktop wallpapers. In-app `FishLogo` and the empty-hero mark also used `currentColor`, so sidebar and welcome chrome stayed black on light themes. The product mark operators expect is DeepSeek brand blue `#4D6BFE` on a white desktop tile. Local builds also labeled the sidebar `DSH Local Build` / `DSH 本地构建` instead of the product name operators use.

## Decision

The shipped web favicon keeps the same whale path and uses a constant `fill="#4D6BFE"` on a transparent canvas. `website/public/favicon.svg` carries the same file. Desktop packaging points `build.icon` at `apps/desktop/build/icon.svg`: a 1024×1024 canvas with a rounded white plate and a smaller centered brand-blue whale. `FishLogo`, the empty-hero mark, and the wordmark's leading whale share exported `DEEPSEEK_BRAND_BLUE` (`#4D6BFE`). Local-build sidebar and document-title copy use `DeepseekHarness` via `common.brand.localBuild` (en and zh).

This supersedes the black/white SVG pair in the [archived favicon dark-mode note](../../archived/bug-fix/2026-08-10-web-favicon-dark-mode.md) for the shipped system icon color. That archive remains historical authority for why the mark once adapted in browser chrome; the active color for system and in-app whale marks is brand blue.

## Alternatives considered

**Keep one transparent favicon as the Electron icon source.** Rejected because Dock and desktop tiles need an opaque white plate; a transparent mark disappears against dark wallpapers.

**Embed the operator-supplied raster JPG as the icon source.** Rejected because the repository already holds the exact vector path; recoloring that path preserves crisp scaling for favicon, PWA, and Electron rasterization.

**Leave in-app marks on `currentColor` and only recolor the favicon.** Rejected because operators see the sidebar and hero marks as the same product icon and expect brand blue there too.

## Consequences

Web tabs, the install manifest icon, and the documentation site favicon show a transparent brand-blue whale. Newly packaged desktop apps show a rounded white plate with a smaller brand-blue whale in the Dock and on the desktop. Sidebar brand marks and the empty-hero whale stay brand blue without the white plate. Local builds show `DeepseekHarness` in the sidebar title and default document title. Rebuilds that skip Electron Builder icon regeneration may keep a cached `.icns` until the next full package. Older Safari that ignores SVG favicons still has no PNG fallback in this tree; that gap is unchanged. Official builds that inject `BrandWordmark` for the sidebar name keep that wordmark artwork; only the local-build locale string changed.

## Verification

`apps/web/tests/pwa-manifest.e2e.ts` asserts the built `favicon.svg` contains `fill="#4D6BFE"` and does not contain `fill="#000"`. `apps/desktop/tests/icon.spec.ts` asserts `build/icon.svg` contains a rounded white plate, brand-blue fill, and that `package.json` `build.icon` points at it. `packages/client/ui-primitives/tests/icons.client.spec.tsx` asserts `FishLogo` paints `DEEPSEEK_BRAND_BLUE`. Sidebar and built-boot tests assert the local-build brand string `DeepseekHarness`.
