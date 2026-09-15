# Agent Note: Desktop fork upgrade path through externalized customizations

Status: implemented

English | [中文](2026-09-09-desktop-fork-upgrade-path.zh.md)

## Problem

This fork ships a desktop application whose behavior differs from the upstream release: a Tencent CodeBuddy provider route, a browser tool suite, an MCP manager and its settings page, a Skills settings page, a model seat that blocks text-only routes while an image rides the next request, a 16384px image bound, and the production brand artwork. Upstream `dsh-v0.1.5-rc.2` ships its own Electron application, so the merge adopted upstream's `apps/desktop` as the base and re-applied the fork's behavior onto it.

That merge left two problems. Packaging embeds an auto-update origin, and the default deployment resolves `https://download.deepseek.com`; a user who installs an upstream release through that feed replaces the packaged seed and loses every fork-only package. And the fork's behavior lived partly in patches to upstream files, so every upstream upgrade re-resolves the same conflicts.

## Decision

The packaged updater does not follow the upstream release stream. `.github/workflows/desktop-macos.yml` packages against a deployment-owned origin that serves nothing today, so the startup check fails silently and no upstream build is offered; a repository variable switches the origin once an internal feed exists.

Externalizing the fork's behavior proceeds in two tiers, because the two tiers have different prerequisites.

**Tier 1 — composition, requiring no upstream change.** A customization that a validated `Config` field, a swappable plugin slot, or a build-environment variable can express moves out of patched source. The 16384px per-side image bound is the first: `attachment-local` already declares `maxImageDimension` as a validated field, so `packages/bundle/desktop-app/cordis.patch.yml` sets it and `packages/attachment/attachment-local` matches upstream again. The brand mark is already a swappable occupant: `ui-brand-official` fills `sidebar.brand.mark` and `sidebar.brand.name`, and `sidebar.brand.name` is a single slot that a later registration can shadow at a lower priority. The product title reads `process.env.DSH_CLIENT_TITLE` before its locale fallback.

**Tier 2 — upstream extension points, which the fork cannot supply alone.** Ten upstream source files still carry fork behavior, in four groups:

- `packages/api/session-controller` projects the route's declared input modalities into the client catalog and forwards a refresh request; the skill directory surface that used to live here now has its own package.
- `packages/client/ui-model-selection` blocks text-only routes while an image rides the next request. It reads `useInput`, an existing session seat, and needs no new framework surface — only the modality field above.
- `packages/client/ui-settings-models` generalizes the onboarding step: `preferredProvider` is a validated config field and readiness takes that provider as a parameter.
- `packages/llm/llm-pi-ai` and `packages/skill/skill` carry the `prepareRequest` adapter hook and the catalog refresh view option. Both follow the shape their neighbours already use: `prepareRequest` sits beside `resolveApiKey`, `resolveAttachments`, and `onReplayDegrade`, and `refresh` travels on `SkillViewOptions` beside `scope`, `cwd`, and `signal`.

Eight Tier-1 moves already landed. `packages/api/remotes` matches upstream again: the browser popup and the MCP settings section each mount their own generated Remote contribution through `ctx.remote.$mount`, the pattern the agent-team client uses, so the shared assembly never names either namespace. The image bound moved into composition. The desktop layer mounts the browser, popup, MCP manager, and MCP settings rows, because upstream's base and web-app bundles carry no browser or MCP row at all — without those rows a packaged build boots the plain Web surface. The onboarding target became a `preferredProvider` config field. The brand artwork moved into `dsh-client-ui-brand-desktop`, which shadows the official occupant at a lower slot priority; reverting `FishLogo` also restored the conversation hero's swim animation, whose morph targets are generated in upstream's coordinate space. The Skills management page and the user skills directory each moved into their own package (`dsh-client-ui-settings-skill` and `dsh-skill-directory`), leaving `ui-skill` on the chat picker alone. `ui-primitives` and `client/locale` match upstream again, and the model seat's host-side image-requirement plumbing was removed because nothing ever set it — the draft's own attachments were always the live signal.

The seven desktop-only packages are publishable and already live outside upstream's tree, so they can be installed into an upstream profile once the packages they patch expose those extension points. `@deepseek-ai/dsh-llm-tencent-codebuddy` already declares `dsh.bundle.patch`, so a CLI profile can add the Tencent route with `dsh plugin` without waiting on those remaining extension points ([installable-bundle note](../architecture/2026-09-15-tencent-codebuddy-installable-profile-bundle.md)).

## Alternatives considered

**Follow the upstream release stream and accept replacement.** Rejected: an upstream release ships a seed without the fork-only packages and without the behavior that lives in patched upstream files, so an installed update would silently remove the Tencent route, the browser suite, the MCP and Skills settings pages, and the image-admission behavior.

**Keep the fork's own `apps/desktop` beside upstream's.** Rejected: upstream's application already owns auto-update, macOS notarization, the seed store, S3 release upload, and Windows signing, so a second desktop application would duplicate all of it and drift.

**Move every customization into external plugins without upstream changes.** Rejected as a complete answer: the model seat's image blocking, the skill catalog's directory actions, the onboarding dialog, and the pi-ai request hook all need extension points that upstream does not declare today, and the browser and MCP surfaces additionally need the `ctx.attachments` and slot contracts the fork already relies on. The two-tier split keeps the work that needs no upstream change separate from the work that does.

## Consequences

Packaging is independent of the upstream release stream, so a user cannot silently lose the fork's customizations to an auto-update. The fork still maintains a branch, but the patch surface is explicit: sixteen upstream files, enumerated here, rather than the whole desktop application.

The image bound is now a deployment value, so a deployment can raise or lower it without a code change; the shared default stays 8192px. Upstream upgrades still conflict on the sixteen files until their extension points exist upstream.

`pnpm run release:pack --family dsh` requires one version across the family, so the seven desktop-only packages carry `0.1.5-rc.2` alongside upstream's packages.

## Testing

`packages/bundle/desktop-app/tests/desktop-app.spec.ts` composes the bundle patch over the base rows and pins `attachment-local`'s composed `maxImageDimension` at 16384. `packages/attachment/attachment-local/tests/index.spec.ts` pins the shared default at 8192, so the two cannot drift together unnoticed. The desktop packaging chain is exercised by `.github/workflows/desktop-macos.yml`, which requires the release identifiers the packaging scripts read.
