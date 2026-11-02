# Design improvements

Design iteration on `2026-10-24-designed-prototype-with-new-storage`, copied as
its starting point. The source experiment remains independent and unchanged.

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
- `src/editor/rich-text/`: rich-text definitions compiled to ProseKit extensions.
  Tasks support bold, italic, links, headings, lists, code blocks, formulas
  (TeX via Temml), spoilers, boxes, images, YouTube videos, GeoGebra applets,
  and tables. Spoilers, boxes, and embeds are plain ProseMirror nodes;
  `renderStaticRichText` turns them into `<details>`, badges, and typeset
  formulas for the learner preview.
- `src/editor/content/`: unit definitions with local authoring renderers for
  text, single/multiple choice, text input, fill-in-the-blank (typed and drag &
  drop), image drag & drop, and free text. Root is an array of explicit
  child-unit variants. Unit IDs key content; rich-text IDs key answer rows and
  scope remote cursors. Answers are inline rich text compared as plain text.
- `src/editor/session.ts`: document/awareness lifetime, document binding, export.
- `src/editor/components/`: authoring UI and local toolbar/focus state.
- `src/demo/`: exercise types with their initial snapshots, two in-memory
  synchronized peers per type, and an interactive learner preview with a simple
  check per exercise (`src/demo/preview/`).

First peer initializes content once. Second peer imports first peer's Yjs state
before binding its root. Transport uses an explicit origin to avoid echo without
losing null-origin edits; awareness starts synchronized and remains editor-scoped.
React subscribes to store-local revisions. Focus/selection and learner answers
never enter structural content or a replicated update counter.

Preview reads typed handles and serializes rich-text JSON with its ProseMirror
schema. It never mounts another editor view. Learner answers stay local to the
preview and are not persisted; "Überprüfen" compares them with the authored
answers, and reset remounts preview. Collaboration remains mounted while hidden.

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
