# Fixed storage, extensible schema

## Problem

A storage API can vary along two dimensions:

- **Storage dimension:** flat in-memory storage, Yjs, database, or another backend.
- **Schema dimension:** booleans, strings, numbers, rich text, educational units, and future domain-specific kinds.

A straightforward design fixes the schema grammar and adds storage implementations. For example, every backend supports the same boolean/string/array/object JSON tree. This makes new backends easy, but adding a new schema kind requires changing the shared value types and every backend implementation.

The desired design reverses this trade-off:

- Add storage backends without changing schema code.
- Add schema kinds without changing existing storage backends.
- Keep schema-specific validation, snapshots, handles, and behavior out of storage implementations.

A visitor with one method per schema kind does not solve this. Adding `number`, `richText`, or `educationalUnit` still requires changing the central visitor and its consumers. A storage class containing `switch (schema.kind)` has the same problem.

## Solution

Use schema-owned interpreters over a fixed, schema-agnostic storage kernel.

The storage kernel stores only generic graph primitives:

```ts
interface Store<Ref> {
  transaction<T>(fn: () => T): T

  scalar(value: boolean | string | number | null): Ref
  readScalar(ref: Ref): boolean | string | number | null
  writeScalar(ref: Ref, value: boolean | string | number | null): void

  record(fields: Record<string, Ref>): Ref
  fields(ref: Ref): Record<string, Ref>
  setField(ref: Ref, key: string, value: Ref): void

  sequence(items: Ref[]): Ref
  items(ref: Ref): Ref[]
  replaceItems(ref: Ref, items: Ref[]): void
}
```

`FlatStore`, `YjsStore`, and future backends implement this interface. They do not import or know schema definitions.

Each schema kind implements its own interpretation:

```ts
interface Schema<Snapshot, Value> {
  decode(input: unknown): Snapshot

  create<Ref>(store: Store<Ref>, snapshot: Snapshot): Ref

  bind<Ref>(store: Store<Ref>, ref: Ref): Value

  snapshot<Ref>(store: Store<Ref>, ref: Ref): Snapshot
}
```

A `number` schema stores a scalar and creates a number handle. An educational-unit schema creates a record containing child references. Neither requires changes to storage backends. New schema kinds ship as independent modules.

Schema composition remains possible through schema helpers:

```ts
const unit = educationalUnit({
  id: string(),
  type: string(),
  content: richText(),
})
```

The storage dependency direction is:

```text
schema packages
  └── depend on Store kernel

FlatStore ─┐
YjsStore  ─┴── know only Store kernel
```

Not:

```text
storage implementations
  └── know every schema kind
```

## Rich text

Rich text has two possible representations.

### Snapshot-oriented rich text

Encode rich-text JSON using records, sequences, strings, numbers, and null. This keeps the kernel generic and makes the schema portable across every backend. Edits may replace larger snapshot regions.

### Collaborative rich text

If rich text needs native collaborative editing, define a capability in the fixed kernel:

```ts
interface Store<Ref> {
  richText(snapshot: RichTextSnapshot): RichTextRef<Ref>
}
```

Every backend implements this capability once. The rich-text schema uses it. Adding another schema kind still does not change existing backends.

This limitation is fundamental: a new schema kind can avoid backend changes only when it lowers into existing primitives or predefined capabilities. Unknown storage-native behavior requires a capability contract somewhere.

## Result

Schema kinds stay open through polymorphic schema objects. Storage implementations stay fixed through a small graph-oriented kernel. Validation, snapshot conversion, live handles, domain behavior, and migrations belong to schemas; references, transactions, and generic data manipulation belong to storage.
