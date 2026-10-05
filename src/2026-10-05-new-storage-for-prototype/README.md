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
drop-in replacement. Implementation checklist lives in [TASKS.md](./TASKS.md).

## Current structure

| Location               | Responsibility                                              |
| ---------------------- | ----------------------------------------------------------- |
| `src/storage/types.ts` | Backend-neutral refs, cells, arrays, maps, and transactions |
| `src/storage/flat.ts`  | In-memory storage using string refs                         |
| `src/storage/yjs.ts`   | Collaborative storage using nested Yjs shared types         |
| `src/schema/`          | Typed schemas, bound handles, and document snapshots        |
| `src/test-utils/`      | Shared tests against both storage implementations           |
| `src/utils/`           | JSON types, guards, and branded types                       |

Schemas currently support strings, numbers, booleans, arrays, objects, and optional
object fields. `createDocument()` creates and attaches a new root; handles read
and edit content and produce snapshots.

## Target integration

Use `YjsNodeStore` with prototype's existing `CDRT.doc`. Keep `FlatNodeStore` for
backend-neutral tests and non-collaborative use; it cannot replace collaboration
by itself.

Keep responsibilities separate:

- **Storage:** content refs, reads, edits, root access, transaction semantics, and
  change notifications.
- **Schema layer:** typed traversal, variant selection, JSON import/export, and
  validation at import boundaries.
- **Editor integration:** rendering metadata, ProseKit editor instances, toolbar,
  local selection, awareness, and React subscriptions.

Prototype's `EditorStore` can remain an editor-facing adapter, but content must
come from this backend rather than parallel legacy Yjs tables. Backend APIs need
not reproduce every method of existing `EditorStore`.

### Rich text

Smallest migration keeps existing `Y.XmlFragment`, `y-prosemirror`, and awareness
integration on the same `Y.Doc`. Structural storage records stable rich-text IDs;
editor integration resolves fragments and imports/exports ProseMirror JSON.

A JSON cell is not a collaborative rich-text implementation: replacing its value
loses character-level merging. Native rich-text storage support is not required
for first migration if fragment bridge preserves existing behavior.

### Identity and schemas

Prototype uses string keys for React rendering, editor caches, selection, and
awareness. Backend refs are not interchangeable with these keys: Yjs refs are
shared-type objects, local to each replica. Integration needs stable node identity
and a way to resolve schema information and children after synchronization.

Prototype also needs literals, wrappers, unions, and rich text. Implement these in
this schema layer or explicit editor-side translation; existing primitive, array,
and object schemas alone cannot represent all prototype behavior.

## Known integration blockers

- Package still has original experiment's name and no consolidated public entry
  point for consumer imports.
- Backend and prototype request different Yjs versions. Separate runtime copies
  break shared-type constructor checks; integration must use one resolved copy.
- Backend transactions have null origin, while prototype's sync helper forwards
  only non-null origins. Direct backend edits therefore do not propagate through
  that helper.
- No public API retrieves and opens existing root. Calling `createDocument()` on
  receiving peer would create a replacement instead of opening synced content.
- Handles expose snapshots but no stable node identity. Existing keyed lookup and
  debug traversal need an integration contract.
- Backend has no subscription/revision contract. Prototype's React hook depends
  on legacy `updateCount`, which backend edits do not change.
- Prototype creates and reads `Y.Array<Key>` / `Y.Map<Key>` directly. Its value
  types and traversal must migrate along with storage implementation.

## Scope

Prepare backend and demonstrate compatibility before migrating prototype. Consumer
changes are listed separately in [TASKS.md](./TASKS.md); this README does not imply
prototype already uses new storage.

Out of scope for first replacement: durable persistence, network transport,
legacy Yjs document migration, global undo redesign, and generic plugin systems.
Preserve external content JSON format; preserving old internal Yjs layout is not
required. Parent links and flat indexes should be derived where possible rather
than added speculatively.

## Checks

From this experiment directory:

```sh
pnpm fix
```

Runs formatting, lint fixes, TypeScript checks, and Bun tests. Repository-wide
checks run from repository root with `bun run fix`.

Current check blocker: package TypeScript check cannot resolve `bun:test`, and
repository TypeScript check cannot resolve Bun type definitions. Fix test-type
setup as part of package preparation; direct Bun tests currently pass.
