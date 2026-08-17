# Schema-Driven Editor API

## Goal

Support multiple storage implementations—such as flat storage, nested storage, and Yjs—without exposing store-specific details to renderers or plugins.

The central rule is:

> Schemas define valid values and editor semantics. Store adapters define how values are stored and mutated.

---

## 1. Schemas with associated types

Each schema carries its corresponding logical value type explicitly.

```ts
interface Schema<Value> {
  readonly kind: string
  readonly __value?: Value
}

type AnySchema = Schema<unknown>

type ValueOf<S extends AnySchema> =
  S extends Schema<infer Value>
    ? Value
    : never
```

This avoids recursively calculating value types from deeply nested schemas, which can exceed TypeScript’s recursion limits.

Schemas describe:

* valid logical values,
* child schemas,
* structural constraints,
* validation,
* nested JSON serialization.

---

## 2. `ValueHandle` as the live editor API

Renderers interact with handles instead of complete JSON values.

```ts
interface ValueHandle<S extends AnySchema> {
  readonly schema: S
  readonly nodeId: NodeId
}
```

A handle internally references a value in a store.

The store reference remains hidden and may be:

```ts
type FlatRef = { key: string }

type NestedRef = {
  path: readonly PathSegment[]
}

type YjsRef = {
  value: Y.AbstractType<unknown>
}
```

Renderers remain independent of the store implementation.

`nodeId` represents stable editor identity and is separate from IDs contained in the document schema itself.

---

## 3. Schema-specific handles

Use a generic base handle with schema-specific APIs.

```ts
interface StringHandle
  extends ValueHandle<StringSchema> {
  get(): string
  set(value: string): void
}
```

```ts
interface ArrayHandle<C extends AnySchema>
  extends ValueHandle<ArraySchema<C>> {
  size(): number

  at(index: number): HandleOf<C>

  map<R>(
    callback: (
      child: HandleOf<C>,
      index: number,
    ) => R,
  ): R[]

  insert(
    index: number,
    value: ValueOf<C>,
  ): HandleOf<C>

  remove(index: number): ValueOf<C>
}
```

Common operations are exposed as methods.

Uncommon operations may later use a generic execution API.

---

## 4. Targeted reads

Renderers should read only the data they need.

For example, consider a simple domain where a document contains a list of tags:

```ts
const tags = array(string())
```

A renderer for this structure should only access the array handle and its children, without reconstructing the full document value.

```ts
function TagsRenderer<C extends AnySchema>({
  current,
}: {
  current: ArrayHandle<C>
}) {
  return (
    <div data-node-id={current.nodeId}>
      {current.map(child => (
        <ElementRenderer
          key={child.nodeId}
          current={child}
        />
      ))}
    </div>
  )
}
```

Each `child` in this case would represent a single tag string handle, and the renderer only subscribes to the parts of the document it actually renders.

Renderers should not reconstruct the complete nested JSON document for ordinary rendering.

A complete logical snapshot is available at the document level.

---

## 5. `DocumentHandle`

The document handle owns document-level operations.

```ts
interface DocumentHandle<S extends AnySchema> {
  readonly root: HandleOf<S>

  snapshot(): ValueOf<S>

  transaction<R>(
    callback: () => R,
  ): R
}
```

Transactions group several mutations into one atomic update.

```ts
document.transaction(() => {
  answers.insert(0, "First")
  answers.insert(1, "Second")
})
```

Subscribers observe only the committed state.

---

## 6. Store adapters

Store adapters implement storage-specific behavior.

```ts
interface StoreAdapter<Ref> {
  bind<S extends AnySchema>(
    schema: S,
    nodeId: NodeId,
    ref: Ref,
  ): HandleOf<S>

  subscribe(
    ref: Ref,
    aspect: SubscriptionAspect,
    listener: () => void,
  ): Unsubscribe

  transaction<R>(
    callback: () => R,
  ): R
}
```

Adapters are responsible for:

* resolving store references,
* reading and writing values,
* creating and deleting nodes,
* subscriptions,
* transactions,
* stable identity mapping,
* garbage collection,
* store-specific optimization.

They should not redefine schema semantics or renderer behavior.

---

## 7. First-class semantic operations

Editor actions may be represented as reusable operation definitions.

```ts
const ArrayInsert = defineOperation({
  name: "array.insert",

  execute<C extends AnySchema>(
    handle: ArrayHandle<C>,
    index: number,
    value: ValueOf<C>,
  ) {
    return handle.insert(index, value)
  },
})
```

This supports future requirements such as:

* undo and redo,
* command logging,
* permissions,
* keyboard commands,
* analytics,
* collaboration.

Common operations remain normal handle methods.

The advanced API should preferably be:

```ts
handle.execute(
  ArrayMove,
  from,
  to,
)
```

rather than a large union-based `dispatch()` API.

---

## Ideas

* React should not directly “subscribe to handles” as a primary abstraction; instead, it should subscribe to *derived reactive views* of the document graph.
* Separate *structural reactivity* (e.g. array/object shape changes) from *value reactivity* (leaf updates) so updates can be more precisely targeted.
* Consider introducing a unified `useValue(handle, selector?)` hook that can express both full-value and partial subscriptions instead of many schema-specific hooks.
* Explore whether subscriptions should be expressed at the schema level (schema declares what is reactive) rather than at the hook level (hooks infer reactivity).
* Investigate a fine-grained dependency tracking system where components automatically track accessed fields during render, similar to proxy-based reactivity systems.
* Evaluate whether `useSyncExternalStore` is sufficient long-term or if a custom scheduler is needed for batching, prioritization, and cross-handle consistency.
* Consider decoupling React entirely from the core subscription model by introducing a framework-agnostic reactive core that React merely adapts to.
* Explore memoization strategies at the handle layer so that unchanged subtrees guarantee referential stability without requiring React-level optimizations.
* Think about supporting non-React consumers (CLI, server rendering, collaborative engines) using the same subscription primitives, ensuring React is just one adapter among many.

---

## 9. Serialization boundary

The logical serialization format is nested JSON.

```ts
interface Codec<
  Value,
  JsonValue,
> {
  decode(
    json: JsonValue,
  ): Result<Value, DecodeError>

  encode(
    value: Value,
  ): JsonValue
}
```

Distinguish three representations:

```text
serialized nested JSON
logical schema value
internal store representation
```

Live editing uses handles.

Import, export, persistence, and migration use codecs and snapshots.

---

## 10. Repository

Loading and saving are asynchronous repository operations.

```ts
interface DocumentRepository {
  open<S extends AnySchema>(
    id: DocumentId,
    schema: S,
  ): Promise<DocumentHandle<S>>

  save<S extends AnySchema>(
    document: DocumentHandle<S>,
  ): Promise<void>
}
```

Live reads and mutations remain synchronous.

---

## 11. Extensibility strategy

Initially, schemas, handles, operations, and adapters are statically known.

This allows:

* closed TypeScript unions,
* explicit handle interfaces,
* strong autocomplete,
* exhaustive checks,
* simpler implementation.

Dynamic plugin registration may be added later through registries and runtime validation.

---

## Important implementation principles

* Avoid recursive conditional types for deriving deeply nested values.
* Keep store references private.
* Use stable logical node identity.
* Prefer schema-specific handles over one generic mutable object.
* Keep `DocumentHandle` narrow.
* Use targeted reads instead of whole-document reads.
* Introduce first-class operations when undo, logging, permissions, or collaboration require them.
* Do not design a low-level instruction language before multiple real adapters reveal common behavior.
* Avoid duplicated dispatch logic across subsystems, but do not avoid all `switch` statements.
* Treat schema compilation and code generation as optional future optimizations.

---

## Open challenges

### Node identity granularity

Determine whether every primitive value needs its own `nodeId`, or whether some values can be addressed through their parent and property key.

### Read API

Determine the final APIs for arrays, objects, tuples, and unions.

### Handle boilerplate

Explicit handle methods create forwarding boilerplate. Possible future solutions include code generation or operation-to-method binding.

### Adapter commonality

After implementing at least two stores, evaluate whether common lower-level storage instructions should be extracted.

---

## Condensed architecture

```text
Schema
├── associated logical value type
├── child schemas
├── constraints
├── validation
└── nested JSON codec

DocumentHandle
├── root handle
├── snapshot()
└── transaction()

ValueHandle
├── schema
├── stable nodeId
├── hidden store reference
└── schema-specific API

StoreAdapter
├── storage access
├── subscriptions
├── transactions
├── identity mapping
└── garbage collection

SemanticOperation
├── editor intent
├── typed arguments
└── future undo/logging/collaboration support

Repository
├── asynchronous loading
└── asynchronous saving
```
