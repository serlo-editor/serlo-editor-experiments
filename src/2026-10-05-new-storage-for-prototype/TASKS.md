# Tasks: Storage support for worksheet modes

Implement support for [separate content, answer, and feedback documents](../../learnings/2026-10-25-how-to-implement-multimode.md).
The consumer is `../2026-10-24-designed-prototype-with-new-storage/`, which contains an independent copy of this experiment's core. Changes here do not automatically update that copy.

Core already supports separate store instances. Main missing feature is genuine read-only access. Additional gaps belong in the schema layer, not low-level storage.

## Current delivery

`ReadonlyNodeStore` stores immutable nested JSON, initialized through the existing
`createDocument()` / `root.getOrCreate()` flow. It returns read-only ProseMirror
editors, keeps revisions at zero, and has no-op subscriptions. It is standalone
snapshot storage, not a facade or live remote view. No capability flag, separate
root lookup/open API, or separate rich-text JSON API is added. Read-only storage
and handle types, plus a smaller rich-text view, remain TODOs.

## Required store features

### 1. Read-only storage capability

Allow reading content, answers, or feedback without permitting content changes.
Current `NodeStore` always exposes creation, transactions, and mutable rich-text editors.

- [x] Add a read-only store implementation or facade with reads, snapshots, revisions, and subscriptions.
- [ ] Expose an explicit writable/read-only capability.
- [x] Reject structural writes and rich-text changes through read-only access.
- [x] Prevent mutation through returned JSON values or collections in read-only storage. Writable flat-store access remains unchanged.
- [ ] Support read-only access to a live store: remote updates remain readable while local writes stay blocked.
- [ ] Reflect read-only access in schema handle types.

Disabling inputs or setting ProseMirror `editable: false` alone does not provide this boundary. Programmatic commands must not bypass it. Storage-level restrictions do not replace application-level authorization.

Relevant files: `src/storage/types.ts`, a new read-only implementation, and schema handle definitions.

### 2. Bind existing documents without initialization

Open read-only documents without invoking write APIs.
Current `createDocument()` calls `root.getOrCreate()`, which enters a transaction even when the root exists.

- [ ] Add non-mutating root lookup.
- [ ] Add a bind/open operation requiring an existing root.
- [ ] Report an explicit error when the root is absent.
- [ ] Separate opening from initialization of writable documents.

Read-only snapshot loading can initialize a private backing store before exposing read-only access. Binding must never silently seed missing content.

Relevant files: `src/storage/types.ts`, `src/storage/flat.ts`, `src/storage/yjs.ts`, and `src/schema/document.ts`.

### 3. Read rich text without exposing a writable editor

Render content and export snapshots without obtaining a mutation-capable editor.
Current `RichTextHandle.snapshot()` calls `getEditor()`, which exposes the full ProseKit editor.

- [ ] Add read-only access to current ProseMirror JSON by rich-text ID and definition.
- [ ] Keep reads current with updates from the underlying collaborative source.
- [ ] Ensure reads never initialize or overwrite shared fragments.
- [x] Restrict mutable editor access to writable stores (read-only storage returns guarded editors).

Reuse existing Yjs unmounted-fragment refresh logic. No second collaboration system is needed.

Relevant files: `src/storage/types.ts`, `src/storage/flat.ts`, `src/storage/yjs.ts`, and `src/schema/rich-text.ts`.

## Recommended store feature

### 4. Explicit store disposal

Manage independently loaded student documents without leaking editors or listeners.
Current document-lifetime cleanup works for the demo; repeated student switching benefits from explicit disposal.

- [ ] Add idempotent `dispose()`.
- [ ] Unmount cached editors, including editors belonging to removed nodes.
- [ ] Detach store-owned Yjs listeners.
- [ ] Clear subscribers and neutralize pending notifications.
- [ ] Define behavior after disposal.
- [ ] Preserve ownership boundaries: do not destroy caller-owned `Y.Doc` or awareness resources.

## Schema features alongside storage

### 5. Dynamic keyed collections

Store answers and feedback keyed by stable target IDs.
Underlying map storage already supports this; the missing piece is a typed schema API. Current `object()` only supports predefined field names.

- [ ] Add `record(valueSchema)` with lookup, insert/replace, remove, iteration, and snapshots.
- [ ] Preserve backend neutrality and read-only restrictions.

Arrays can implement the first version, so this is a convenience rather than a fundamental backend requirement. Add when answer/feedback schemas need keyed access.

### 6. Durable answer-target identity

Keep answers attached to the correct exercise parts after reorder, synchronization, and reopening.
Unit IDs already exist. Extend identity where answers target smaller elements.

- [ ] Add explicit option IDs for multiple-choice choices.
- [ ] Add stable gap IDs in rich-text gap marks.
- [ ] Preserve IDs during normal save/load and edits to unchanged targets.
- [ ] Generate fresh IDs for copied targets.
- [ ] Detect duplicate IDs at import boundaries.

Do not use array positions or rich-text fragment IDs as durable answer keys: snapshot import regenerates rich-text IDs. This work belongs in unit/content schemas and rich-text definitions, not generic storage refs.

## Already supported or outside store scope

- Separate content, answer, and feedback stores: create separate instances; use separate `Y.Doc`s for independent collaborative boundaries.
- Independent revisions and subscriptions: already available.
- Multiple students and analytics: the application joins documents by IDs.
- Worksheet modes, answer schemas, feedback schemas, and content-version mismatch policy: application/schema responsibilities.
- Cross-document atomic transactions: not required by the ADR.

## First delivery and verification

Prioritize read-only access, non-mutating document binding, read-only rich-text reads, and stable option/gap IDs.

- [x] Test blocked structural writes and rich-text commands through read-only access.
- [x] Test that returned read-only values cannot mutate stored content outside write APIs.
- [ ] Test that opening or snapshotting read-only documents causes no shared-content writes.
- [ ] Test that read-only views observe remote updates.
- [ ] Test content/answer/feedback isolation and independent revisions.
- [ ] Test stable target IDs across reorder, reopening, and synchronization.
- [ ] Run applicable backend-neutral tests against both flat and Yjs stores.
- [ ] Port completed changes explicitly to the consumer experiment's copied core.

Run `bun run fix` from this experiment directory after changes.
