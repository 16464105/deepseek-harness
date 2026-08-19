# Agent Note: Desktop profile omits the external vision router

Status: implemented

English | [中文](2026-08-19-desktop-removes-vision-router.zh.md)

## Problem

The desktop application shipped `dsh-vision-router` as an installation-owned profile bundle and production dependency. The desktop composition already has built-in attachment and browser capabilities, and the external router is not required for startup or the default model flow. Keeping it increased the packaged dependency closure and made every existing desktop profile retain the plugin after an application update.

## Decision

The desktop manifest and `PROFILE_TEMPLATES.desktop` omit `dsh-vision-router`. Profile normalization recognizes both prior installation-owned desktop tuples: the tuple containing `dsh-browser` and `dsh-vision-router`, and the later tuple containing only `dsh-vision-router`. Both migrate to the current template while preserving `dsh-better-sidebar`.

Profiles with any other bundle list remain user-owned and are not rewritten.

## Alternatives considered

**Remove only the package dependency.** Rejected because existing stock profiles would continue naming the missing bundle and fail during profile resolution.

**Rewrite every desktop profile containing the plugin.** Rejected because a modified bundle list is user-owned; removing a user-selected plugin would violate profile ownership.

## Consequences

New desktop profiles do not install or load `dsh-vision-router`. Existing stock desktop profiles remove it on the next load. Users who intentionally changed the bundle list keep their configuration and may continue to install the plugin explicitly.

## Verification

The app-boot profile tests cover initialization and both legacy tuples. The Windows package is inspected to confirm that neither the external package nor its lockfile resolution remains in the deploy root.
