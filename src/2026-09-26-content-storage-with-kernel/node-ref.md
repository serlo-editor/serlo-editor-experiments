# Task: Introduce kind-indexed storage references

## Context

`src/storage/` currently uses three independent reference type parameters:

```ts
Storage<CellRef, ArrayRef, MapRef, TransactionContext>
```

`NodeRef<CellRef, ArrayRef, MapRef>` is currently a union of all three references.

Future schema types need to express this relationship:

```text
boolean schema       -> cell reference
array schema         -> array reference
object schema        -> map reference
```

Schema code must remain independent from FlatStorage and YjsStorage. Concrete backend reference types must stay backend-owned.

## Goal

Introduce `StorageKind` and a kind-indexed reference map. Preserve current runtime behavior. Do not implement schemas in this task.

Desired conceptual API:

```ts
export type StorageKind = "cell" | "array" | "map"

export interface StorageRefs {
  cell: unknown
  array: unknown
  map: unknown
}

export type RefOf<Refs extends StorageRefs, Kind extends StorageKind> = Refs[Kind]

export type NodeRef<Refs extends StorageRefs> = Refs[StorageKind]
```

`RefOf<Refs, "cell">` means backend-specific cell reference. `NodeRef<Refs>` means any node reference for that backend.

## Required changes

### 1. Update `src/storage/types.ts`

Change `Storage` from four independent reference parameters to a reference map plus transaction context:

```ts
export interface Storage<Refs extends StorageRefs, TransactionContext> {
  readonly cell: CellStore<Refs["cell"], TransactionContext>
  readonly array: ArrayStore<
    Refs["cell"] | Refs["array"] | Refs["map"],
    Refs["array"],
    TransactionContext
  >
  readonly map: MapStore<
    Refs["cell"] | Refs["array"] | Refs["map"],
    Refs["map"],
    TransactionContext
  >

  attach<Ref extends NodeRef<Refs>>(ref: Ref): Ref
  transact<Result>(callback: (tx: TransactionContext) => Result): Result
}
```

Keep storage operation semantics unchanged.

Export the following types from `types.ts`:

- `StorageKind`
- `StorageRefs`
- `RefOf`
- `NodeRef`
- `Storage`

Keep `CellStore`, `ArrayStore`, and `MapStore` private unless TypeScript requires exporting them.

Do not change `JSONValue` behavior in this task. Cells may continue accepting current `JSONValue` values.

### 2. Update `FlatStorage`

Define a Flat reference map:

```ts
type FlatRefs = {
  cell: FlatCellRef
  array: FlatArrayRef
  map: FlatMapRef
}
```

Prefer kind-branded references so TypeScript can distinguish Flat cell, array, and map references even if all use string keys internally:

```ts
type FlatRef<Kind extends StorageKind> = string & {
  readonly [flatStorageRefSymbol]: Kind
}

type FlatCellRef = FlatRef<"cell">
type FlatArrayRef = FlatRef<"array">
type FlatMapRef = FlatRef<"map">
```

Update:

- `FlatStorageContract`
- `ReferenceTable` types
- `StorageRefGenerator`
- `attach`
- array item types
- map field types

Runtime keys may remain unchanged (`node:0`, `node:1`, etc.). Do not add persisted kind data to Flat keys.

Reference tables must continue rejecting references that do not exist.

### 3. Update `YjsStorage`

Define a Yjs reference map:

```ts
type YjsRefs = {
  cell: YCell
  array: YArray
  map: YMap
}
```

Update `YjsStorageContract` to use:

```ts
Storage<YjsRefs, Y.Transaction>
```

Keep Yjs runtime representation unchanged. Do not add schema knowledge or schema tags to Yjs nodes.

Use `NodeRef<YjsRefs>` for mixed array items and map field values.

### 4. Update storage tests and type usages

Update `src/storage/index.test.ts` and any other storage files to use the new `Storage<Refs, TransactionContext>` shape.

Preserve current cross-backend test coverage. Do not add new test files or unrelated behavior.

Existing tests must continue to verify:

- cell reads and edits
- array reads and insertions
- map reads and field updates
- mixed nested references
- FlatStorage and YjsStorage parity
- transaction behavior
- reference validation

### 5. Update exports

`src/storage/index.ts` should export the new public type utilities if consumers need them:

```ts
export type { NodeRef, RefOf, Storage, StorageKind, StorageRefs } from "./types.ts"
```

Do not export backend implementation reference types unless current API requires them.

## Design constraints

- `StorageKind` describes storage node shape, not schema identity.
- Schema kinds such as `boolean`, `string`, `richText`, and `educationalUnit` are not `StorageKind` values.
- `Ref` remains opaque and backend-specific.
- A reference must not contain a schema kind.
- A reference must not be serialized as document content.
- Do not introduce a central `switch` over future schema kinds.
- Do not add rich-text or educational-unit support.
- Do not modify transaction semantics.
- Do not narrow cell values yet.

## Expected future usage

This task should make the following schema API typeable later:

```ts
interface Schema<Snapshot, Value, Kind extends StorageKind> {
  readonly kind: string
  readonly storageKind: Kind

  decode(input: unknown): Snapshot

  create<Refs extends StorageRefs, Tx>(
    storage: Storage<Refs, Tx>,
    snapshot: Snapshot,
  ): RefOf<Refs, Kind>

  bind<Refs extends StorageRefs, Tx>(storage: Storage<Refs, Tx>, ref: RefOf<Refs, Kind>): Value

  snapshot<Refs extends StorageRefs, Tx>(
    storage: Storage<Refs, Tx>,
    ref: RefOf<Refs, Kind>,
  ): Snapshot
}
```

A boolean schema should return `RefOf<Refs, "cell">`. An array schema should return `RefOf<Refs, "array">`. An object schema should return `RefOf<Refs, "map">`.

## Acceptance criteria

- `StorageKind` exists with exactly `"cell" | "array" | "map"`.
- `RefOf<Refs, Kind>` resolves to the backend-specific reference type.
- `NodeRef<Refs>` resolves to the union of backend-specific references.
- FlatStorage and YjsStorage compile against new `Storage` signature.
- Flat references are statically distinguishable by storage kind where practical.
- Runtime behavior remains unchanged.
- Existing storage test command passes:

```bash
pnpm --dir src/2026-09-26-content-storage-with-kernel test
```

- No schema implementation is added in this task.
