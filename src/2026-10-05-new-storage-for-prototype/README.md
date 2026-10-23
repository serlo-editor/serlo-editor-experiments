# New storage for editor prototype

## Goal

Prepare this experiment to replace content storage in
[`2026-10-05-current-prototype`](../2026-10-05-current-prototype/).
Starting point: 1:1 copy of
[`2026-09-26-content-storage-with-kernel`](../2026-09-26-content-storage-with-kernel/).
This copy is where replacement work happens; original experiment remains unchanged.

Replacement must preserve prototype behavior: schema-driven content, collaborative
rich-text editing, checkbox updates, formatting controls, remote cursors, JSON
export, and debug views. Current implementation is a foundation, not yet a
drop-in replacement. Remaining integration work is tracked in `tasks/`.

## Current structure

| Location               | Responsibility                                              |
| ---------------------- | ----------------------------------------------------------- |
| `src/storage/types.ts` | Backend-neutral refs, cells, arrays, maps, and transactions |
| `src/storage/flat.ts`  | In-memory storage using string refs                         |
| `src/storage/yjs.ts`   | Collaborative storage using nested Yjs shared types         |
| `src/schema/`          | Typed schemas, bound handles, and document snapshots        |
| `src/test-utils/`      | Shared tests against both storage implementations           |
| `src/utils/`           | JSON types, guards, and branded types                       |

Schemas currently support strings, numbers, booleans, arrays, objects, optional
object fields, and rich text. `createDocument()` creates and attaches a root when store has none;
otherwise it binds existing root and ignores supplied initial snapshot. Handles
read and edit content and produce snapshots.

## Target integration

Use `YjsNodeStore` with prototype's existing `CDRT.doc`. Keep `FlatNodeStore` for
backend-neutral tests and non-collaborative use; it cannot replace collaboration
by itself.

Keep responsibilities separate:

- **Storage:** content refs, reads, edits, root access, transaction semantics,
  change notifications, local rich-text editor caches, and backend-specific
  collaboration/awareness extensions.
- **Schema layer:** typed traversal, variant selection, JSON import/export, and
  validation at import boundaries.
- **Editor integration:** rendering metadata, editor mounting, toolbar, local
  selection, shared awareness transport, and React subscriptions.

Prototype's `EditorStore` can remain an editor-facing adapter, but content must
come from this backend rather than parallel legacy Yjs tables. Backend APIs need
not reproduce every method of existing `EditorStore`.

### Rich text

`src/schema/rich-text.ts` stores `{ kind: "richText", editorId }` in an ordinary
cell. No extra node kind or ref type is needed. UUID-based IDs survive reopening,
sibling edits, and synchronization; importing copied content creates fresh IDs.
External snapshots contain ProseMirror JSON, not internal IDs.

```ts
import { richText as definition } from "./src/rich-text/index.ts"
import { richText } from "./src/schema/index.ts"

const schema = richText({
  definition: definition.inline({ marks: { bold: true } }),
})
// Bound handle: handle.id, handle.getEditor(), handle.snapshot().
```

Both stores expose `createRichText({ definition, defaultContent, extensions,
onViewUpdate })` and `getEditor(id, options)`.
The store caches editor instances locally; definitions, supplied extensions, and
`onViewUpdate` callbacks are never replicated. Configuration is fixed when the
local editor is first created. The flat store owns content in cached editor state.
Its content notifications are coalesced into a microtask, including headless edits.

`YjsNodeStore(doc, { awareness })` resolves IDs to named `Y.XmlFragment`s on the
same document and supplies ProseKit's Yjs extensions. Caller-owned awareness is
required and filtered by editor ID. Only creation initializes fragments; lookup never resets
shared content. Rich-text changes, including remote edits, advance local revisions
without appending structural revision entries.

Snapshots use `getEditor().getDocJSON()`. Lookup refreshes unmounted Yjs editor
state from the fragment, so snapshots include remote changes without mounting or
writing shared content. Mount Yjs editors before editing; headless collaborative
writes are not supported. `src/rich-text/` remains independent of Yjs.

Callers unmount views when no longer used. There is no disposal API or automatic
fragment garbage collection yet: editor caches follow store lifetime, and Yjs
store revision tracking follows document lifetime.

### Identity and schemas

Prototype uses string keys for React rendering, editor caches, selection, and
awareness. Backend refs are not interchangeable with these keys: Yjs refs are
shared-type objects, local to each replica. Integration needs stable node identity
and a way to resolve schema information and children after synchronization.

Prototype also needs literals, wrappers, unions, and rich-text schema integration. Implement these in
this schema layer or explicit editor-side translation; existing primitive, array,
and object schemas alone cannot represent all prototype behavior.

## Known integration blockers

- Package has no consolidated public entry point for consumer imports.
- Backend and prototype request different Yjs versions. Separate runtime copies
  break shared-type constructor checks; integration must use one resolved copy.
- `YjsNodeStore` uses its instance as the non-null origin for its transactions,
  so direct backend edits propagate through prototype's current sync helper.
  Transactions nested in an outer Yjs transaction retain the outer origin; a
  null-origin outer transaction is still dropped by that helper.
- Rich-text handles expose stable editor IDs; other handles still lack stable
  node identity. Existing keyed lookup and debug traversal need an integration
  contract.
- Prototype's React hook still depends on legacy `updateCount`; editor adapter
  must bridge storage revisions, rich-text changes, and local UI state.
- Prototype creates and reads `Y.Array<Key>` / `Y.Map<Key>` directly. Its value
  types and traversal must migrate along with storage implementation.

## Scope

Prepare backend and demonstrate compatibility before migrating prototype.
Remaining work is listed in `tasks/`; this README does not imply prototype already
uses new storage.

Out of scope for first replacement: durable persistence, network transport,
legacy Yjs document migration, global undo redesign, and generic plugin systems.
Preserve external content JSON format; preserving old internal Yjs layout is not
required. Parent links and flat indexes should be derived where possible rather
than added speculatively.

## Checks

From this experiment directory:

```sh
bun run fix
```

Runs formatting, lint fixes, TypeScript checks, and Bun tests. Repository-wide
checks run from repository root with `bun run fix`.

Package formatting, lint, TypeScript, and Bun tests pass.
