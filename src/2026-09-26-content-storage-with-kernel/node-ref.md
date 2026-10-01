# Task: Introduce kind-indexed node references

## Context

`src/storage/` currently uses three independent reference type parameters:

```ts
NodeStore<CellRef, ArrayRef, MapRef, TransactionContext>
```

`NodeRef<CellRef, ArrayRef, MapRef>` is currently a union of all three references.

Future schema types need to express this relationship:

```text
boolean schema       -> cell reference
array schema         -> array reference
object schema        -> map reference
```

Schema code must remain independent from FlatNodeStore and YjsNodeStore. Concrete backend reference types must stay backend-owned.

## Goal

Introduce `NodeKind` and a kind-indexed reference map. Preserve current runtime behavior. Do not implement schemas in this task.

Conceptual API:

```ts
export type NodeKind = "cell" | "array" | "map"

export interface NodeRefsByKind {
  cell: unknown
  array: unknown
  map: unknown
}

export type NodeRef<Refs extends NodeRefsByKind, Kind extends NodeKind = NodeKind> = Refs[Kind]
```

`NodeRef<Refs, "cell">` means backend-specific cell reference. `NodeRef<Refs>` means any node reference for that backend.

## Required changes

### 1. Update `src/storage/types.ts`

Change `NodeStore` from four independent reference parameters to a reference map plus transaction context:

```ts
export interface NodeStore<Refs extends NodeRefsByKind, TransactionContext> {
  readonly cell: CellStore<NodeRef<Refs, "cell">, TransactionContext>
  readonly array: ArrayStore<NodeRef<Refs>, NodeRef<Refs, "array">, TransactionContext>
  readonly map: MapStore<NodeRef<Refs>, NodeRef<Refs, "map">, TransactionContext>

  attach<Ref extends NodeRef<Refs>>(ref: Ref): Ref
  transact<Result>(callback: (tx: TransactionContext) => Result): Result
}
```

Export `NodeKind`, `NodeRefsByKind`, `NodeRef`, and `NodeStore`. Keep `CellStore`, `ArrayStore`, and `MapStore` private. Keep editor interfaces and `JSONValue` behavior unchanged.

### 2. Update `FlatNodeStore`

Define backend-owned references:

```ts
type FlatNodeRefs = {
  cell: Branded<string, "cell">
  array: Branded<string, "array">
  map: Branded<string, "map">
}
```

Use existing `Branded<>` from `src/utils.ts`, with a string key per node kind. Update `ReferenceTable`, `NodeRefGenerator`, `attach`, array item types, and map field types to use the new references.

Runtime keys may remain unchanged (`node:0`, `node:1`, etc.). Do not add persisted kind data to Flat keys. Reference tables must continue rejecting references that do not exist.

### 3. Update `YjsNodeStore`

Define a Yjs reference map:

```ts
type YjsNodeRefs = {
  cell: YCell
  array: YArray
  map: YMap
}
```

Use `NodeStore<YjsNodeRefs, Y.Transaction>`. Use `NodeRef<YjsNodeRefs>` for mixed array items and map field values.

Keep Yjs runtime representation unchanged. Do not add schema knowledge or schema tags to Yjs nodes.

### 4. Update storage tests and type usages

Update `src/storage/index.test.ts` and other storage usages to use `NodeStore<Refs, TransactionContext>`.

Preserve current cross-backend test coverage. Do not add test files or unrelated behavior.

### 5. Update exports

`src/storage/index.ts` should export:

```ts
export type { NodeKind, NodeRef, NodeRefsByKind, NodeStore } from "./types.ts"
```

Do not export backend implementation reference types.

## Design constraints

- `NodeKind` describes storage node shape, not schema identity.
- Schema kinds such as `boolean`, `string`, `richText`, and `educationalUnit` are not `NodeKind` values.
- `NodeRef` remains opaque and backend-specific.
- A reference must not contain a schema kind.
- A reference must not be serialized as document content.
- Do not introduce a central `switch` over future schema kinds.
- Do not add rich-text or educational-unit support.
- Do not modify transaction semantics.
- Do not narrow cell values yet.

## Expected future usage

```ts
interface Schema<Snapshot, Value, Kind extends NodeKind> {
  readonly kind: string
  readonly storageKind: Kind

  decode(input: unknown): Snapshot

  create<Refs extends NodeRefsByKind, Tx>(
    storage: NodeStore<Refs, Tx>,
    snapshot: Snapshot,
  ): NodeRef<Refs, Kind>

  bind<Refs extends NodeRefsByKind, Tx>(
    storage: NodeStore<Refs, Tx>,
    ref: NodeRef<Refs, Kind>,
  ): Value

  snapshot<Refs extends NodeRefsByKind, Tx>(
    storage: NodeStore<Refs, Tx>,
    ref: NodeRef<Refs, Kind>,
  ): Snapshot
}
```

A boolean schema should return `NodeRef<Refs, "cell">`. An array schema should return `NodeRef<Refs, "array">`. An object schema should return `NodeRef<Refs, "map">`.

## Acceptance criteria

- `NodeKind` exists with exactly `"cell" | "array" | "map"`.
- `NodeRef<Refs, Kind>` resolves to the backend-specific reference type; `NodeRef<Refs>` resolves to the union.
- Flat and Yjs stores compile against the new `NodeStore` signature.
- Flat references are statically distinguishable by node kind where practical.
- Runtime behavior remains unchanged.
- Existing storage test command passes:

```bash
pnpm --dir src/2026-09-26-content-storage-with-kernel test
```

- No schema implementation is added in this task.
