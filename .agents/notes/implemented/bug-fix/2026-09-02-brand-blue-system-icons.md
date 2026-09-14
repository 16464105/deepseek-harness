# Agent Note: System icons use DeepSeek brand blue

Status: implemented

English | [中文](2026-09-02-brand-blue-system-icons.zh.md)

## Problem

`apps/web/public/favicon.svg` painted the DeepSeek whale black and switched to white under `prefers-color-scheme: dark`. Electron Builder derived every desktop application icon from that SVG, so the Dock and Windows shell received a black mark on a transparent canvas that reads poorly against dark desktop wallpapers. In-app `FishLogo` and the empty-hero mark also used `currentColor`, so sidebar and welcome chrome stayed black on light themes. The product mark operators expect is DeepSeek brand blue `#4D6BFE` on a white desktop tile. Local builds also labeled the sidebar `DSH Local Build` / `DSH 本地构建` instead of the product name operators use.

## Decision

Desktop packaging points `build.icon` at `apps/desktop/build/icon.png`: a 1024×1024 rounded-plate raster of the operator-supplied artwork. `apps/web/public/favicon.png` and `website/public/favicon.png` carry a 192×192 copy of the same plate. In-app `FishLogo`, the empty-hero mark, and the wordmark's leading whale stay the brand-blue vector (`DEEPSEEK_BRAND_BLUE`) because the artwork is unreadable at sidebar and hero sizes. Local-build sidebar and document-title copy use `DeepseekHarness` via `common.brand.localBuild` (en and zh).

This supersedes the black/white SVG pair in the [archived favicon dark-mode note](../../archived/bug-fix/2026-08-10-web-favicon-dark-mode.md) for the shipped system icon color. That archive remains historical authority for why the mark once adapted in browser chrome; the active color for system and in-app whale marks is brand blue.

## Alternatives considered

**Keep one transparent favicon as the Electron icon source.** Rejected because Dock and desktop tiles need an opaque white plate; a transparent mark disappears against dark wallpapers.

**Keep the brand-blue vector as the Dock and tab icon.** Superseded when operators supplied a complete raster plate and asked every system icon to use it.

**Leave in-app marks on `currentColor` and only recolor the favicon.** Rejected because operators see the sidebar and hero marks as the same product icon and expect brand blue there too.

## Consequences

Web tabs, the install manifest icon, the documentation site favicon, and newly packaged desktop apps show the operator artwork on a rounded plate. Sidebar brand marks and the empty-hero whale stay the brand-blue vector. Local builds show `DeepseekHarness` in the sidebar title and default document title. Rebuilds that skip Electron Builder icon regeneration may keep a cached `.icns` until the next full package. Older Safari that ignores SVG favicons still has no PNG fallback in this tree; that gap is unchanged. Official builds that inject `BrandWordmark` for the sidebar name keep that wordmark artwork; only the local-build locale string changed.

## Verification

`apps/web/tests/pwa-manifest.e2e.ts` asserts the built `favicon.png` is a PNG and that the install manifest names it. `apps/desktop/tests/icon.spec.ts` asserts `build/icon.png` is a PNG and that `package.json` `build.icon` points at it. `packages/client/ui-primitives/tests/icons.client.spec.tsx` asserts `FishLogo` paints `DEEPSEEK_BRAND_BLUE`. Sidebar and built-boot tests assert the local-build brand string `DeepseekHarness`.
