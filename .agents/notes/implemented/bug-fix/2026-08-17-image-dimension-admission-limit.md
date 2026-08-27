# Agent Note: Per-side image dimension admission limit

Status: implemented

English | [中文](2026-08-17-image-dimension-admission-limit.zh.md)

## Problem

`read_image` durably committed an image and appended its block to session history before any dimension check beyond byte count and total pixels. Deployed model routes reject a request with HTTP 400 when it carries many images and any of them has a side above 2000px. An admitted image rides every later request of its session, so one oversized read poisoned the durable history: the next model request failed, and so did every retry, permanently killing the session. The same gap applied to every other image producer (host uploads, MCP tool images) because admission had no per-side bound at all.

## Decision

`ImageAttachmentLimits` carries `maxImageDimension`, enforced during the admission full decode (`detectImage`) as `IMAGE_DIMENSION_TOO_LARGE`, so every producer that commits through the attachment service refuses an oversized image before anything reaches durable history. `LocalAttachmentStore` exposes it as the `maxImageDimension` config field with default `DEFAULT_MAX_IMAGE_DIMENSION = 16384`, a sanity bound for pathological aspect ratios that sits far above real captures; the effective hard limit for one image is total decoded pixels (`maxImagePixels`). Deployments that want no per-side bound at all can raise it from cordis.yml. `read_image` maps `IMAGE_DIMENSION_TOO_LARGE` and `IMAGE_TOO_MANY_PIXELS` to model-facing errors that name the resolved path and the limit and tell the model to downscale and retry — the turn continues as a recoverable tool error. The Web composer surfaces `IMAGE_DIMENSION_TOO_LARGE` with dedicated copy naming the limit. The `read-image-dimension` snapshot scenario replays the refusal keylessly through the assembled app: a 2001x16385 workspace fixture (total pixels far below `maxImagePixels`), a recoverable tool error, and a completed turn.

## Alternatives considered

- **Downscale at admission instead of refusing.** Resampling changes the stored bytes away from what the caller supplied, adds a resampling-quality policy, and hides the limit from the model. Refusal keeps admission a pure gate; the model or user can downscale with full knowledge. Worth revisiting only if refusals prove frequent in practice.
- **Enforce at the provider adapter per route.** Too late: by the time a request is assembled the image is already durable history, so every route and every retry re-fails. Admission is the last point where a provider-rejected image can be kept out.
- **Repair already-poisoned sessions** (drop or replace the oversized block on later requests). Out of scope for this fix; admission prevents new poisonings, and history rewriting needs its own design against the model-visible ⟺ logged invariant.

## Related

- [Minimal read_image tool](../feature/2026-08-10-minimal-read-image-tool.md) — the tool whose admission gap this closes.
- [Web image intake and limits alignment](../feature/2026-08-12-web-image-intake-and-limits-alignment.md) — the composer-side surfacing of the same `ImageAttachmentLimits`.

## Consequences

- One oversized `read_image` can no longer break a session; the model sees an actionable error and the turn completes.
- Images with a side above 16384px are refused even in compositions whose routes would accept them; such deployments must raise `maxImageDimension` explicitly, and total decoded pixels remains the effective hard bound.
- Sessions that already carry an oversized image remain broken; this change does not repair existing history.
