# Designed editor with new storage

Reimplementation of `2026-10-24-current-prototype-with-new-design`, using the
storage/schema core copied from `2026-10-05-new-storage-for-prototype`.
Source experiments remain independent and unchanged.

## Run and check

```sh
bun dev
bun run fix
bun run build
```

## Structure

- `src/editor/storage/`: backend-neutral cells, arrays, maps, transactions,
  revisions, and subscriptions. `FlatNodeStore` supports local use and tests;
  `YjsNodeStore` owns collaborative content on one document with shared awareness.
- `src/editor/schema/`: typed handles, snapshots, units, and rich text.
- `src/editor/content/`: text, gap, and multiple-choice unit definitions and
  local authoring renderers. Root is an array of explicit child-unit variants.
  Unit IDs key content; rich-text IDs key option rows and scope remote cursors.
- `src/editor/content/`: typed unit definitions and initial snapshots. This demo
  seeds content directly from those definitions; external JSON import/export is
  not part of this prototype.
- `src/editor/session.ts`: document/awareness lifetime, document binding, export.
- `src/editor/components/`: authoring UI and local toolbar/focus state.
- `src/demo/`: two in-memory synchronized peers and interactive learner preview.

First peer initializes content once. Second peer imports first peer's Yjs state
before binding its root. Transport uses an explicit origin to avoid echo without
losing null-origin edits; awareness starts synchronized and remains editor-scoped.
React subscribes to store-local revisions. Focus/selection and learner answers
never enter structural content or a replicated update counter.

Preview reads typed handles and serializes rich-text JSON with its ProseMirror
schema. It never mounts another editor view. Learner answers have no grading or
persistence; reset remounts preview. Collaboration remains mounted while hidden.

## Lifetime and limits

App creates sessions in an effect, including under StrictMode. Rich-text components
register local callbacks and mount/unmount views; session destruction disconnects
transport, unmounts cached editors, and destroys awareness/documents. Editors and
revision tracking follow session/document lifetime; no automatic fragment garbage
collection or backend disposal API is added.

Transactions do not roll back. Collaborative rich-text writes require mounted
views. Imports validate the whole content tree before creating shared documents,
but this does not turn arbitrary backend transactions into atomic imports.
Document-wide React subscriptions are deliberate; granular subscriptions can be
added if rendering cost warrants them.

No persistence, network provider, legacy Yjs-layout migration, generic node index,
external JSON import/export, new debug panels, or global undo redesign.
