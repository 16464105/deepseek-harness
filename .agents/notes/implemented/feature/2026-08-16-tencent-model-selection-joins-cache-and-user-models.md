# Agent Note: Tencent models ship as a fixed catalog with a user-editable directory

Status: implemented

English | [中文](2026-08-16-tencent-model-selection-joins-cache-and-user-models.zh.md)

## Problem

The Tencent CodeBuddy adapter initially served the models cached by the locally installed CodeBuddy desktop client, with a visibility map on the card. That design made the served catalog depend on a local SQLite database: a fresh machine shows nothing until the desktop client populates the cache, the user cannot add a model the cache does not list, and the provider's true model set — a fixed list served by the internal gateway — is hidden behind machine-local state. The endpoint exposes no OpenAI-compatible `/models` listing to interrogate instead.

## Decision

**The package owns a fixed catalog.** `src/catalog.ts` holds the 29 desktop chat models (the `craft`/`ask`/`plan` union projected once from a captured desktop-client cache) with display name, context window, output cap, image support, and reasoning capability. The schema materializes this catalog as the `models` default, so a bare mount serves the full directory with no local database read at all. The SQLite cache reader, the `stateDatabase` config field, the `modelVisibility` map, and the discovery registration are gone.

**A configured `models` list replaces the catalog wholesale** — the same contract the direct DeepSeek adapter keeps for its advisory catalog — which is how the Models page edits the directory. The first edit materializes the complete array in the user layer; **Restore defaults** unsets it; duplicate ids are refused by `resolveProfiles` where they are written.

**The Tencent card is the DeepSeek shape.** The endpoint stays fixed, so the card offers the API key field and the collapsed 自定义设置 fold only, with the fixed directory rendered by `DeepSeekModelsEditor` through its schema default. No fetch action, no visibility checkboxes, no extra-model section: the directory itself is the edit surface.

## Alternatives considered

**Reading the local desktop cache** — the previous design; rejected because it made the served catalog machine-local state, required an explicit refresh action, and failed startup without a usable database.

**Interrogating the Tencent endpoint for a listing** — rejected because `https://copilot.tencent.com/v2/models` answers 404; the gateway publishes its models through the desktop client's product configuration, which the shipped catalog now pins.

**Keeping the visibility map beside the fixed catalog** — rejected because the directory editor replaces its function: hiding a model is deleting its row, and the refresh flow it existed for is gone.

**A user-side fetch of the desktop cache into the directory** — rejected because it would reintroduce the machine-local read the fixed catalog removes, and the shipped snapshot is the same union the cache projects.

## Consequences

The Tencent route serves its fixed catalog on any machine, no local state required; the Models card edits that directory directly like the DeepSeek card. Loader, provider, wiring, and client tests pin the fixed catalog, the replace semantics, and the card shape; the web e2e snapshots show the 29-model picker. Tencent changes to its gateway models reach deployments through the next package release or a user `models` override, not through a cache refresh.
