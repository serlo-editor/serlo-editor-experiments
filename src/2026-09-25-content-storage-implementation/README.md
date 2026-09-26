# Content storage implementation

## Goal

Extend the JSON-storage experiment into schema-directed editor-content storage. Compare two implementations behind one `ContentStorage` API:

- **`LocalContentStorage`** uses `FlatNodeStore` for structure and local ProseMirror editors for rich text. No Yjs document backs local content.
- **`YjsContentStorage`** uses `Y.Map` / `Y.Array` for structure and `Y.XmlFragment` for rich text, all in one `Y.Doc`.

Share schema definitions, snapshot types, and value-handle interfaces, not a lowest-common-denominator backend. Keep each backend's recursive creation and binding explicit.

## Content model

A schema describes booleans, strings, arrays, objects, and rich-text leaves. Rich text is a leaf of the content tree even though its exported ProseMirror JSON contains objects and arrays. The schema distinguishes these cases.

`save(schema, snapshot)` returns typed handles:

- Primitive handles expose `get()` and `set()`.
- Array handles expose `get()` and `map()`.
- Object handles expose `get()` and `field(key)`.
- Rich-text handles expose `get()` for a ProseMirror JSON snapshot and `editor()` for a local ProseKit editor instance.

`get()` recursively exports snapshots, never editor instances. Rich-text attributes follow the ProseMirror schema; the boolean/string restriction applies only to structural primitives.

## Ownership

- Local rich-text editors own their ProseMirror state and survive view unmounting.
- Yjs fragments own collaborative rich-text content. Editors bind through `ySyncPlugin` and remain local runtime resources, not serialized values. Rich-text editing requires a mounted browser view; headless `editor.setContent()` / `editor.updateState()` is not a supported Yjs write API. Snapshot export works without a DOM.
- Both implementations cache editors lazily and release mounted views when storage is disposed.
- Yjs storage uses an optional caller-owned `Y.Doc`; disposing storage must not destroy an externally supplied document.
- Structural handles read current backend values instead of capturing stale primitive snapshots. Array handles are index-based; stable identity across structural reordering is outside this prototype.
- Treat storage and its handles as unusable after disposal; do not retain editor instances beyond storage lifetime.
- Each `save()` creates an independent root. Reopening saved roots by ID is outside this prototype.

The experiment does not compose an existing `JSONStorage` instance with an editor bucket. `FlatNodeStore` and typed buckets remain implementation details of the local backend.

## What to demonstrate

- Saving and exporting equivalent schema-directed content with either backend.
- Updating nested structural values through typed handles.
- Exporting rich text without mounting an editor or requiring a DOM.
- Accessing rich-text editors for browser-side editing.
- Independent saved roots and explicit storage disposal.
- Yjs-backed storage working without a network provider.

## Usage

```ts
import { defineBaseKeymap, union } from "prosekit/core"
import { defineDoc } from "prosekit/extensions/doc"
import { defineParagraph } from "prosekit/extensions/paragraph"
import { defineText } from "prosekit/extensions/text"

import { LocalContentStorage, YjsContentStorage } from "./content-storage.ts"
import { richText, type Schema } from "./schema.ts"

const schema = {
  kind: "object",
  fields: {
    published: { kind: "boolean" },
    body: richText(union(defineDoc(), defineParagraph(), defineText(), defineBaseKeymap())),
  },
} as const satisfies Schema

const storage = new LocalContentStorage() // Or: new YjsContentStorage(doc)
const content = storage.save(schema, {
  published: false,
  body: { type: "doc", content: [{ type: "paragraph" }] },
})

content.field("published").set(true)
content.field("body").editor() // In browser: .mount(element)
content.get() // Plain snapshot, including ProseMirror JSON
storage.dispose()
```

Rich-text extensions must include a complete ProseMirror document schema. Keep backend-specific collaboration and history plugins out of the shared extension. Snapshots are validated before saving; unknown or missing object fields are rejected. Yjs transactions batch writes, not roll back failures.

Run the headless example:

```sh
pnpm --dir src/2026-09-25-content-storage-implementation dev
```

Typecheck:

```sh
pnpm --dir src/2026-09-25-content-storage-implementation build
```

## Files

- `content-storage.ts`: shared value interfaces and separate local / Yjs implementations.
- `schema.ts`: content schemas, snapshot types, and import validation.
- `rich-text-storage.ts`: backend-specific rich-text ownership and lazy editors.
- `flat-storage.ts`, `buckets.ts`: local structural storage.
- `index.ts`: headless example using both backends.
- `content-storage.test.ts`: renamed, adapted checks from the copied experiment.

## Scope

This prototype covers in-memory storage and editor binding. Do not add network providers, presence, browser persistence, structural insert/delete/move APIs, cross-editor undo, concurrent-edit guarantees, migrations, or a generic plugin system for arbitrary leaf types.

Existing copied checks are adapted to the renamed API; no new test suite is introduced.
