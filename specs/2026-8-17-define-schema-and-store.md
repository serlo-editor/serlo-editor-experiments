# Recommended Architecture for Schema-Driven Editor Stores

Use a **schema-driven command architecture with typed value handles, semantic operations, default lowering, and store adapters**.

## 1. Schema as the source of truth

Each schema carries its associated logical value type and semantic operation type through explicit associated types.

```ts
interface Schema<Value, Operation> {
  readonly kind: string

  readonly __types?: {
    value: Value
    operation: Operation
  }
}

type AnySchema = Schema<unknown, unknown>

type ValueOf<S extends AnySchema> =
  NonNullable<S["__types"]>["value"]

type OperationOf<S extends AnySchema> =
  NonNullable<S["__types"]>["operation"]
```

Do not recursively calculate value types through large conditional types. Deeply structured schemas have already exceeded TypeScript’s recursion limits.

Schemas also describe:

* child schemas,
* structural constraints,
* semantic operations,
* codecs for nested JSON,
* universal default implementations of operations.

## 2. `ValueHandle` as the renderer-facing abstraction

Replace the conceptual meaning of `CurrentValue` with a **handle to a stored value**.

```ts
interface ValueHandle<S extends AnySchema> {
  readonly schema: S
  readonly nodeId: NodeId

  dispatch(operation: OperationOf<S>): void
}
```

A handle contains or closes over:

```text
schema
stable logical nodeId
private store reference
store adapter
```

The store reference remains private and may differ by adapter:

```ts
type FlatRef = {
  key: string
}

type NestedRef = {
  path: readonly PathSegment[]
}

type YjsRef = {
  value: Y.AbstractType<unknown>
}
```

This allows renderers to use:

```tsx
<div data-node-id={current.nodeId} />
```

without depending on whether the underlying store uses keys, paths, or Yjs objects.

Every schema value, including scalar values, has a stable `nodeId`.

## 3. Schema-specific handle APIs

Handles should expose targeted structural reads rather than forcing renderers to read an entire nested JSON snapshot.

```ts
interface ArrayHandle<C extends AnySchema>
  extends ValueHandle<ArraySchema<C>> {
  length(): number

  child(index: number): HandleOf<C>

  map<R>(
    callback: (
      child: HandleOf<C>,
      index: number,
    ) => R,
  ): R[]

  insert(
    index: number,
    value: ValueOf<C>,
  ): void

  remove(index: number): void
}
```

Example:

```tsx
function ArrayRenderer<C extends AnySchema>({
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

The parent renderer observes array structure. Each child renderer observes its own value.

The exact read API remains open, including whether complete snapshots, `children()`, or selector APIs should also be exposed.

## 4. First-class semantic operations

Represent editor actions as first-class semantic operation definitions.

```ts
const ArrayInsert = defineOperation({
  name: "array.insert",

  create<C extends AnySchema>(
    index: number,
    value: ValueOf<C>,
  ) {
    return {
      type: "array.insert" as const,
      index,
      value,
    }
  },

  defaultImplementation(context, operation) {
    // Lower into store instructions.
  },
})
```

The same operation supports multiple APIs:

```ts
current.insert(0, value)

insert(current, 0, value)

current.dispatch(
  ArrayInsert.create(0, value),
)
```

The operation definition is the single source of truth.

Handle methods are convenience wrappers around `dispatch()`.

## 5. Explicit handle methods initially

Use explicit handle implementations for common operations.

```ts
class ArrayHandleImplementation<C extends AnySchema>
  implements ArrayHandle<C>
{
  insert(
    index: number,
    value: ValueOf<C>,
  ) {
    this.dispatch(
      ArrayInsert.create(index, value),
    )
  }

  remove(index: number) {
    this.dispatch(
      ArrayRemove.create(index),
    )
  }
}
```

Use standalone functions for uncommon or optional operations.

```ts
move(current, from, to)
duplicate(current, index)
```

This provides:

* good autocomplete,
* simple typing,
* transparent runtime behavior,
* explicit control over the renderer API.

The principal challenge is boilerplate. Every common semantic operation must be manually forwarded from its handle method to its operation definition.

```ts
insert(index, value) {
  this.dispatch(
    ArrayInsert.create(index, value),
  )
}
```

Automatic binding or code generation can reduce this boilerplate later without changing the public API.

## 6. Semantic operations versus store instructions

Separate editor intent from storage mechanics.

```text
Semantic operation:
ArrayInsert

Store instructions:
AllocateValue
InsertReference
```

The complete pipeline is:

```text
renderer
    ↓
ValueHandle method
    ↓
semantic operation
    ↓
store-specific override?
    ├── yes → specialized implementation
    └── no  → universal default lowering
                  ↓
           store instruction program
                  ↓
             store adapter
```

Semantic operations preserve domain meaning. They may later support:

* undo,
* analytics,
* permissions,
* collaboration,
* event logs.

Store instructions describe lower-level storage changes.

## 7. Universal default implementations

Each semantic operation has one universal default implementation.

```ts
const ArrayInsert = defineOperation({
  name: "array.insert",

  defaultImplementation(ctx, operation) {
    const childRef = ctx.allocateValue(
      ctx.schema.childSchema,
      operation.value,
    )

    return ctx.insertReference(
      ctx.ref,
      operation.index,
      childRef,
    )
  },
})
```

A flat store may use this default directly.

A Yjs store may override the complete semantic operation:

```ts
yjsAdapter.override(
  ArrayInsert,
  (ctx, operation) => {
    ctx.yArray.insert(
      operation.index,
      [
        ctx.convertToYValue(
          operation.value,
        ),
      ],
    )
  },
)
```

This lets stores optimize operations without redefining their semantic meaning.

## 8. Typed store instruction support

A store declares which low-level instructions it implements.

```ts
type InstructionName =
  | "allocateValue"
  | "setScalar"
  | "insertReference"
  | "removeReference"
  | "replaceReference"

interface StoreAdapter<
  Supported extends InstructionName,
> {
  readonly handlers: {
    [K in Supported]:
      InstructionHandler<K>
  }
}
```

Default operation implementations declare their instruction requirements.

```ts
interface Program<
  Required extends InstructionName,
  Result,
> {
  readonly required: Required
}
```

A semantic operation is executable when the store either:

1. provides a direct override, or
2. supports all instructions required by the default implementation.

For now, adapter compatibility may be validated at startup or fail with an explicit runtime error.

```text
YjsStore cannot execute ObjectReplace:

- no direct override exists
- required instruction "replaceReference" is missing
```

Proving all fallback relationships entirely through TypeScript remains a future challenge.

## 9. Store adapter responsibilities

A store adapter owns storage-specific concerns.

```ts
interface StoreAdapter<Ref> {
  bind<S extends AnySchema>(
    schema: S,
    nodeId: NodeId,
    ref: Ref,
  ): HandleOf<S>

  subscribe(
    ref: Ref,
    listener: () => void,
  ): Unsubscribe

  execute(
    instruction: StoreInstruction,
  ): unknown

  transaction<R>(
    callback: () => R,
  ): R
}
```

Its responsibilities include:

* reference resolution,
* low-level instruction execution,
* subscriptions,
* transactions,
* node allocation,
* garbage collection,
* stable identity mapping,
* store-specific operation overrides.

It should not independently redefine:

* schema validation,
* semantic operation meaning,
* codecs,
* renderer behavior.

## 10. Schema compilation

Compile schemas once into specialized runtime handlers.

```ts
const compiled =
  compileSchema(schema)

compiled.createHandle(...)
compiled.validate(...)
compiled.encode(...)
compiled.decode(...)
compiled.lowerOperation(...)
```

Compilation can:

* resolve operation definitions,
* bind child-schema behavior,
* collect instruction requirements,
* validate adapter compatibility,
* create handle factories,
* isolate unavoidable type assertions,
* reduce repeated registry lookup.

This is a form of partial evaluation. Schema-dependent decisions happen once rather than during every render or mutation.

## 11. Nested JSON codecs

The external logical serialization format is nested JSON.

```ts
interface Codec<Value, JsonValue> {
  decode(
    json: JsonValue,
  ): Result<Value>

  encode(
    value: Value,
  ): JsonValue
}
```

The stores may internally use:

* normalized flat nodes,
* nested objects,
* Yjs values.

```text
nested JSON
    ↕
schema codec
    ↕
store import/export
    ↕
internal representation
```

Codecs are used for:

* persistence,
* import,
* export,
* migration,
* snapshots.

Live editing uses `ValueHandle` and semantic operations rather than repeatedly encoding and decoding complete JSON values.

## 12. React integration

React components should subscribe only to the smallest semantic data slice they render.

```ts
const childIds =
  useHandleSelector(
    array,
    snapshot =>
      snapshot.childIds,
  )

const text =
  useHandleSelector(
    stringHandle,
    snapshot =>
      snapshot.value,
  )
```

The parent array component subscribes to child identity and order.

A child renderer subscribes to its own scalar or structural data.

A child text update should not change the parent’s structural snapshot.

An insertion should update the parent because child membership changed.

Use `useSyncExternalStore` or a selector-based wrapper around it.

```ts
function useHandleSelector<S, R>(
  handle: ValueHandle<S>,
  selector: (
    snapshot: SnapshotOf<S>,
  ) => R,
): R
```

Stable handles, stable React keys, atomic transactions, and referentially stable selector results are required to avoid unnecessary rerenders.

## 13. Extensibility strategy

For now, schemas, operations, instructions, and adapters are statically known.

This permits:

* closed unions,
* explicit handle interfaces,
* exhaustive operation types,
* simpler compilation,
* stronger TypeScript inference.

Dynamic plugin registration remains a future feature.

It would require:

* runtime registries,
* namespaced identifiers,
* startup validation,
* versioning,
* weaker compile-time exhaustiveness.

# Open challenges

## Instruction granularity

The low-level instruction vocabulary is still undecided.

It must be:

* generic enough for flat, nested, and Yjs stores,
* expressive enough for atomic mutations,
* independent of normalized storage,
* not so high-level that every store needs operation-specific handlers.

Possible starting point:

```ts
allocateValue(...)
setScalar(...)
insertReference(...)
removeReference(...)
replaceReference(...)
```

## Read API

The schema-specific read interface remains undecided.

Open questions:

* Should complete snapshots be available?
* Should `map()` subscribe automatically?
* Should `children()` return arrays of handles?
* How should object properties expose child handles?
* How should union variants expose child handles?
* How fine-grained should selectors be?

## Explicit handle boilerplate

The initial explicit-method approach creates forwarding boilerplate.

```ts
insert(index, value) {
  this.dispatch(
    ArrayInsert.create(
      index,
      value,
    ),
  )
}
```

Possible future solutions:

* mapped-type binding,
* schema compilation,
* code generation.

## Compile-time adapter compatibility

Compile-time proof that every operation has either an override or all required fallback instructions remains a future challenge.

Runtime or startup validation is sufficient initially.

# Future ideas

## Schema modules

Package schema metadata, associated types, operations, codecs, and validators together.

```ts
interface SchemaModule<
  Value,
  Operation,
> {
  schema: SchemaDescription

  operations:
    OperationDefinitions<Operation>

  codec:
    Codec<Value, Json>

  validator:
    Validator<Value>
}
```

This strengthens plugin colocation and resembles ML modules or typeclass dictionaries.

## Code generation

Generate concrete:

* value types,
* handle types,
* forwarding methods,
* codecs,
* operation unions.

This can eliminate handle boilerplate and bypass TypeScript recursion limits.

## CQRS concepts

Keep queries, commands, and optional persisted events distinct.

```text
ValueHandle reads
Semantic operations command
Operation log may later become events
```

Full event sourcing is not required.

## Repository and aggregate patterns

A document repository can own:

* loading,
* saving,
* opening,
* document-level transactions.

Aggregate boundaries may later enforce invariants across related values atomically.

## Lenses and optics

Lenses, prisms, and traversals may later provide reusable typed paths through:

* object schemas,
* tuple schemas,
* union schemas,
* collection schemas.

They are not required for the initial architecture.

# Condensed design

```text
Schema
├── associated value type
├── associated operation type
├── constraints
├── child schemas
├── universal operation definitions
└── nested JSON codec

CompiledSchema
├── handle factory
├── validator
├── codec
├── operation lowering
└── instruction requirements

ValueHandle
├── stable nodeId
├── hidden store reference
├── targeted read API
├── dispatch()
└── explicit convenience methods

SemanticOperation
├── editor intent
├── typed arguments
├── universal default implementation
└── required instructions

StoreAdapter
├── instruction handlers
├── optional semantic overrides
├── subscriptions
├── transactions
├── reference resolution
└── garbage collection
```

The central architectural rule is:

> Schemas and semantic operations define editor meaning. Store adapters define how that meaning is executed in a particular storage model.

