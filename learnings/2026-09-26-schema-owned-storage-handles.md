# Schema-owned storage handles

## Goal

Implement extensible schemas over existing [`NodeStore`](../src/2026-09-26-content-storage-with-kernel/src/storage/types.ts), following [fixed storage, extensible schema](./2026-09-26-storage-fixed-schema-extensible.md). Storage backends remain schema-agnostic and unchanged.

## Public contract

Types below use existing storage types and `JSONValue`.

```ts
interface SnapshotHandle<Snapshot extends JSONValue> {
  snapshot(): Snapshot
}

interface Schema<
  Snapshot extends JSONValue,
  Handle extends SnapshotHandle<Snapshot>,
  Kind extends NodeKind,
> {
  create<Refs extends NodeRefsByKind, Tx>(
    store: NodeStore<Refs, Tx>,
    snapshot: Snapshot,
  ): SchemaRef<Refs, Kind, Snapshot>

  bind<Refs extends NodeRefsByKind, Tx>(
    store: NodeStore<Refs, Tx>,
    ref: SchemaRef<Refs, Kind, Snapshot> & RootRef,
  ): Handle
}

type SchemaRef<
  Refs extends NodeRefsByKind,
  Kind extends NodeKind,
  Snapshot extends JSONValue,
> = Kind extends "cell" ? CellRef<Refs["cell"], Snapshot> : Refs[Kind]
```

- `create` builds nodes without attaching them. Snapshots are trusted; no `decode` or runtime validation for now.
- `bind` returns live handles closing over store and ref. Public binding requires existing `RootRef` brand from `store.attach`.
- `snapshot()` belongs to handles, not schemas; it reads current storage state.
- Handles expose domain-specific operations and transact internally for each mutation. No multi-operation atomicity promised.

## Initial schemas

```ts
interface StringHandle extends SnapshotHandle<string> {
  get(): string
  set(value: string): void
}

interface ArrayHandle<
  Item extends JSONValue,
  Child extends SnapshotHandle<Item>,
> extends SnapshotHandle<readonly Item[]> {
  at(index: number): Child
  insert(index: number, value: Item): void
}
```

- `string()` returns `Schema<string, StringHandle, "cell">`. Use `cell.create`, `cell.get`, and transactional `cell.edit(...).set`.
- `array(childSchema)` infers child snapshot and handle types. Use `array.create`, `array.get`, and transactional `array.edit(...).insert`.
- Array creation builds fresh child nodes, then an array containing their refs. Insertion creates a fresh child node; never reuse attached Yjs nodes under another parent.
- `at(index)` reads current array contents and throws for absent index. Returned child handle stays bound to that child ref, even if later insertions shift indices.
- Array snapshots read current child refs and collect their handle snapshots.

## Composition and attachment

Implement schemas through shared `defineSchema(...)` factory. Factory owns private node interpreters (e.g. in a `WeakMap`) and exposes only public `create` and root-only `bind` on schema objects.

Interpreter callbacks receive composition context containing store and `createChild(childSchema, snapshot)` / `bindChild(childSchema, ref)` operations. Child binding does not require `RootRef`; public binding still does. Independently authored schema modules compose through this context without exposing raw interpreters or adding a central registry. Localize child-ref type assertions inside composition helpers.

Schema authors are trusted implementation code. Attachment restriction protects application-facing API, not malicious schema implementations.

Attach only outermost ref, once, before binding or reading. This also integrates nested Yjs types. Never attach individual children.

`RootRef` prevents forgotten attachment at public binding boundary; it does not prove parentlessness, store identity, or graph membership. Type assertions can bypass this guarantee.

## Optional: schema-type branding

Current refs distinguish storage kind, not complete schema. For example, refs from `array(string())` also fit `array(array(string()))`. Optionally add invariant phantom brand for snapshot and handle compatibility:

```ts
declare const schemaType: unique symbol

type SchemaBrand<Snapshot, Handle> = {
  readonly [schemaType]: (snapshot: Snapshot, handle: Handle) => [Snapshot, Handle]
}

type BrandedSchemaRef<
  Refs extends NodeRefsByKind,
  Kind extends NodeKind,
  Snapshot extends JSONValue,
  Handle,
> = SchemaRef<Refs, Kind, Snapshot> & SchemaBrand<Snapshot, Handle>
```

If enabled, use `BrandedSchemaRef<Refs, Kind, Snapshot, Handle>` for public `create` return type and `bind` ref parameter, retaining `& RootRef` for binding. Function-property brand requires strict function type checking to enforce invariance.

`defineSchema` applies brand through localized assertion after interpreter creates node; no runtime property or backend changes. `attach` preserves schema brand while adding `RootRef`. Composition helpers restore child brands after schema-agnostic storage reads, relying on trusted construction.

Schema brand checks compatible interpretation; `RootRef` checks attachment. Schemas with identical snapshot/handle types remain compatible. Exact schema-instance identity, store identity, and runtime validation stay out of scope. Branding is optional, not required for initial implementation.

## Optional: StorageSession

Add application-facing `StorageSession` when explicit single-root lifecycle enforcement is needed. Session privately owns backend access and exposes `createRoot(schema, snapshot)`, inferring and returning schema's handle type.

```ts
const session = new StorageSession(new FlatNodeStore())
const schema = array(string())

const names = session.createRoot(schema, ["Ada"])
names.insert(1, "Grace")
names.snapshot() // ["Ada", "Grace"]

session.createRoot(schema, ["Alan"]) // Throws: root already created
```

- `createRoot` combines schema `create`, store `attach`, and schema `bind`. Application does not call `attach` directly.
- Reject second root creation before allocating nodes. Failure/retry policy remains separate decision; no rollback guarantee.
- Use one session per store/document; application must not bypass session through underlying backend. Enforcement covers local session calls, not remote Yjs root replacement.
- Backend implementations remain unchanged. Persisted-root loading, existing-root adoption, root replacement, and old-handle invalidation are outside initial scope.

Session is optional. Without it, attach-once remains usage convention rather than enforced lifecycle rule.

## Usage

```ts
const store = new FlatNodeStore()
const schema = array(string())

const ref = schema.create(store, ["Ada", "Linus"])
// schema.bind(store, ref) // Type error: missing RootRef

const root = store.attach(ref)
const names = schema.bind(store, root)

names.at(0).get() // "Ada"
names.at(1).set("Alan")
names.insert(1, "Grace")
names.snapshot() // ["Ada", "Grace", "Alan"]

const retrieved = schema.bind(store, root)
retrieved.at(1).get() // "Grace"
retrieved.snapshot() // ["Ada", "Grace", "Alan"]
```

Same schema code must work with `FlatNodeStore` and `YjsNodeStore`. No central schema-kind union, visitor, or backend-specific schema branches.
