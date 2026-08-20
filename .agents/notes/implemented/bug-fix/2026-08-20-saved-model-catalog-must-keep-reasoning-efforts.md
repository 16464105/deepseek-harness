# Agent Note: The saved model catalog must keep reasoning efforts

Status: implemented

English | [中文](2026-08-20-saved-model-catalog-must-keep-reasoning-efforts.zh.md)

## Problem

Adding a model to a top-level provider section (Tencent CodeBuddy) materializes every default catalog row into the draft, carrying each row's `reasoningEfforts` dict. The client-side rehydrated schema can reject that dict (a serialized-schema drift between Host and client), so `validateDraft` failed the save even though the Host's own schema accepts the value.

An earlier fix stripped `reasoningEfforts` from the draft rows and saved the stripped copy. That made the save succeed but silently disabled reasoning on every model the edit replaced: the saved catalog no longer declared the effort ladder, so the composer offered no levels for those models.

## Decision

The stripped copy is a **client-side validation aid only**. The save path validates the stripped draft to decide whether the Host will accept the write, but persists the **unstripped** draft (`save(next)`), because the Host's authoritative schema accepts the full dict and dropping `reasoningEfforts` from the saved catalog would silently disable reasoning on every model it replaces.

Separately, a row added on the Tencent card is **seeded** with image input and the full reasoning-effort ladder (`low`…`max`) via a `newRowDefaults` prop, so a hand-added model can actually use both capabilities instead of inheriting none.

## Alternatives considered

- **Strip and save the stripped copy**: rejected — silently disables reasoning on the replaced catalog (the bug this note fixes).
- **No client-side validation fallback**: rejected — the false negative blocks the save entirely; the stripped copy is the cheapest reliable signal that the Host will accept the write.

## Consequences

- Adding a model to Tencent (or any top-level provider section) saves the full catalog rows, keeping every capability field the catalog carries.
- A new Tencent row is born with image input and the full reasoning ladder, so it is immediately usable.
- The stripped-draft validation stays as a client-side gate; the Host's schema remains the authority on what is persisted.
