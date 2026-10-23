# Collaborative unit editor prototype

Reimplementation of `../2026-10-05-current-prototype` using storage and schemas
copied from `../2026-10-05-new-storage-for-prototype`.

## Run

From this package:

```sh
bun dev
bun run fix
bun run build
```

Install workspace dependencies with `bun install` from repository root.

## Structure

- `src/editor/`: unchanged storage/schema backend, rich-text definitions, and tests.
- `src/demo/content.tsx`: root prototype unit containing a list of text,
  multiple-choice, and fill-in-the-gap units, plus their React renderers and legacy
  JSON import/export conversion.
- `src/demo/RichTextField.tsx`: mounted ProseKit editors with per-field formatting
  controls and local selection reporting. No global editor registry.
- `src/demo/session.ts`: two Yjs sessions, one initial document, and React revision
  subscriptions. Second session binds the synchronized root, never seeds its own.
- `src/demo/sync-cdrts.ts`: in-process content/awareness transport with explicit
  origins and listener cleanup; null-origin local updates propagate too.
- `src/demo/DebugPanel.tsx`: single panel below both editors, initially showing
  previous content-only JSON format and first editor's local selection. Document
  snapshots and derived unit/field structure remain available as toggles.
- `src/demo/prototype.spec.tsx`: schema and mounted collaborative UI integration
  checks, including concurrent edits, stable identities, and teardown.

Typing, correctness checkboxes, formatting, and remote cursors synchronize between
both editors. Unit IDs and rich-text IDs are stable across replicas. Rich-text JSON
snapshots contain content, not editor IDs. Toolbars follow each field's selection;
Gap appears only for gap exercises.

## Legacy content

`importContent(legacyArray)` converts typed original content into a root-unit
snapshot with fresh unit IDs. It validates using existing schemas in an isolated
flat store before any collaborative document is touched. Loading that snapshot
creates fresh rich-text IDs. `exportContent(snapshot)` returns the original array
shape without internal IDs.

Pass the result to `createPrototypeSessions(snapshot)` to initialize both demo
replicas from legacy content. Only first replica seeds content; second binds the
synchronized root. These functions accept structured values, not JSON strings.

Each session rerenders after storage revisions; selection-only updates stay local.
React unmounts editor views, and session cleanup disconnects transport and destroys
awareness/documents. Backend caches follow store lifetime; unused fragment garbage
collection remains deferred.

No durable persistence, network server, legacy Yjs layout migration, or new
unit-authoring controls. Reload restores example content.
