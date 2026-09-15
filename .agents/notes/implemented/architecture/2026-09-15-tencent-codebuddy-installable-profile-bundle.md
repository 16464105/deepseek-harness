# Agent Note: Tencent CodeBuddy as an installable profile bundle

Status: implemented

English | [中文](2026-09-15-tencent-codebuddy-installable-profile-bundle.zh.md)

## Problem

The Tencent CodeBuddy adapter only reached a running dsh when [`dsh-desktop-app`](../../../../packages/bundle/desktop-app/README.md) inserted it. `dsh plugin --profile <name> add` activates a layer only for a package that declares `dsh.bundle.patch`, so installing `@deepseek-ai/dsh-llm-tencent-codebuddy` into `web`, `headless`, `sdk`, or `acp` left a plain dependency and never mounted `tencent-internal`. Tencent employees who start from those shipped profiles had no supported install path for the internal route.

## Decision

**`@deepseek-ai/dsh-llm-tencent-codebuddy` is both the adapter plugin and the installable profile bundle.** It lives in `packages/tencent-internal/`, beside `packages/llm/`. Its manifest declares `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`. The patch inserts the `llm-tencent-codebuddy` row and replaces `agent-default-model` with `tencent-internal/hy3-ioa`. It does not set `ui-settings-models.preferredProvider`, so first-run does not prompt for the CodeBuddy key.

**The shipped desktop profile still mounts the adapter through `dsh-desktop-app`.** Desktop keeps the three-bundle prefix `base + web-app + desktop-app` and the nested insert, so existing Electron profiles do not need a persisted bundle-list migration. Other profiles add or remove the route with `dsh plugin --profile <name> add|remove @deepseek-ai/dsh-llm-tencent-codebuddy`. Do not add the bundle to a tree that already inserts `llm-tencent-codebuddy`: a second insert duplicates the adapter row.

Wire facts stay in this package: fixed endpoint, OpenAI Chat Completions protocol, CodeBuddy headers, payload normalization, and the package-owned catalog. That adapter contract is unchanged from the [desktop CodeBuddy note](../feature/2026-08-16-electron-desktop-tencent-codebuddy.md) and the [catalog note](../feature/2026-08-16-tencent-model-selection-joins-cache-and-user-models.md).

## Alternatives considered

**A separate wrapper bundle package that only carries the patch.** Rejected because [`dsh-subagent-codex`](../../../../packages/subagent/subagent-codex/README.md) already ships one package as both plugin and bundle, and a second package would exist only to insert this adapter.

**Move the adapter out of `dsh-desktop-app` into `DESKTOP_PROFILE_BUNDLES`.** Deferred because Electron reads `dsh.profile.bundles` from the profile manifest at Host boot, independently of the plugin-manager prefix helper. Changing the built-in prefix without a persisted rewrite would drop Tencent from existing desktop installs that still nest the insert only inside `desktop-app`.

**Insert the adapter without changing the default model.** Rejected because the layer's purpose is the Tencent route as the default; leaving official DeepSeek as the default would hide that route behind a manual selector after `dsh plugin add`.

**Retarget first-run onboarding onto the CodeBuddy key field.** Rejected: first-run does not prompt for that key. The Models page and the credentials service still store `TENCENT_CODEBUDDY_API_KEY`.

## Consequences

CLI profiles can add the Tencent route without editing `dsh-desktop-app`. The shipped desktop composition still nests the adapter insert and does not retarget Models onboarding onto the CodeBuddy key. Stacking the bundle on desktop duplicates the adapter row, which the package README forbids.

## Testing

`packages/tencent-internal/llm-tencent-codebuddy/tests/bundle.spec.ts` composes the declared patch over a base-backed tree, a tree that lacks `agent-default-model`, and a tree that already inserted the adapter, and leaves `ui-settings-models` unpatched. `dsh plugin --profile web add` of this package against a scratch home lists it in `dsh.profile.bundles`; `--dump-default-config` then shows one `llm-tencent-codebuddy` row and `tencent-internal/hy3-ioa`, and does not set `preferredProvider`. `dsh plugin --profile web remove` withdraws the row and restores the web default.
