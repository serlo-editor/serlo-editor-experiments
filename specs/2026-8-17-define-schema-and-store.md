# Schema-Driven Editor API Architecture

## Objective

The editor should support multiple storage implementations—such as flat storage, nested storage, and Yjs—without exposing storage details to renderers or plugins.

The high-level architecture is:

```text
Schema
  ↓
ValueHandle
  ↓
Semantic operation
  ↓
Store-specific override or universal default
  ↓
Store instructions
  ↓
Store adapter
```

The central rule is:

> Schemas and semantic operations define editor semantics. Store adapters define how those semantics are executed in a particular storage model.

---

# 1. Schemas and associated types

Each schema carries its corresponding logical value and operation types explicitly.

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

This avoids recursively calculating types such as `ValueOf<S>` from deeply nested schema structures.

Recursive conditional type derivation has already proven unsuitable because complex document schemas can exceed TypeScript’s type-instantiation limits.

A schema may additionally define:

* child schemas,
* structural constraints,
* semantic operations,
* validation,
* nested JSON codecs,
* universal default operation implementations.

---

# 2. `ValueHandle` as the primary live-editing API

The primary API represents a live location in the document rather than a complete value snapshot.

```ts
interface ValueHandle<S extends AnySchema> {
  readonly schema: S
  readonly nodeId: NodeId

  dispatch(
    operation: OperationOf<S>,
  ): OperationResult
}
```

A handle conceptually contains or closes over:

```text
schema
stable logical nodeId
private store reference
store adapter
```

The store-specific reference is hidden from renderers and plugins.

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

Renderer and plugin code must not depend on these reference representations.

---

# 3. Stable node identity

Every schema value has a stable logical `nodeId`, including scalar values.

```ts
interface ValueHandle<S extends AnySchema> {
  readonly nodeId: NodeId
  readonly schema: S
}
```

The `nodeId` remains stable when:

* the value changes,
* an array element moves,
* the nested path changes,
* the internal store reference changes.

It may be used by renderers:

```tsx
<div data-node-id={current.nodeId} />
```

It may also be used for:

* React keys,
* editor selections,
* diagnostics,
* operation history,
* collaboration,
* tracking a logical node across structural changes.

The logical `nodeId` is distinct from identifiers that may occur inside the document schema itself.

For example, a schema may contain a domain-level `id` field:

```json
{
  "id": "exercise-123",
  "question": "What is 2 + 2?"
}
```

That field belongs to the document value. It is not necessarily the same as the editor’s internal `nodeId`.

---

# 4. Handle identity

The API guarantees stable semantic identity through `nodeId`.

It does not guarantee stable JavaScript object identity.

```ts
firstHandle.nodeId === secondHandle.nodeId
```

may be true even when:

```ts
firstHandle !== secondHandle
```

Store implementations may cache handles, but application code should not depend on this.

---

# 5. Generic base handles and schema-specific handles

The API uses a generic base handle with schema-specific extensions.

```ts
interface ValueHandle<S extends AnySchema> {
  readonly schema: S
  readonly nodeId: NodeId

  dispatch(
    operation: OperationOf<S>,
  ): OperationResult
}
```

Example array handle:

```ts
interface ArrayHandle<C extends AnySchema>
  extends ValueHandle<ArraySchema<C>> {
  length(): number

  map<R>(
    callback: (
      child: HandleOf<C>,
      index: number,
    ) => R,
  ): R[]

  insert(
    index: number,
    value: ValueOf<C>,
  ): Result<HandleOf<C>, ArrayInsertError>

  remove(
    index: number,
  ): Result<RemovedValue<C>, ArrayRemoveError>
}
```

Example string handle:

```ts
interface StringHandle
  extends ValueHandle<StringSchema> {
  value(): string

  set(
    value: string,
  ): Result<void, StringSetError>
}
```

Schema-specific APIs provide:

* better autocomplete,
* clear operation availability,
* targeted reads,
* renderer ergonomics,
* type-safe child handles.

---

# 6. Targeted reads instead of full JSON reads

Renderers should normally use schema-specific targeted reads.

For an array:

```ts
array.length()

array.map((child, index) => {
  return renderChild(child)
})
```

For a string:

```ts
stringHandle.value()
```

The renderer should not need to reconstruct the complete nested JSON value in order to render one node.

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

`map()` is the preferred high-level traversal API.

A lower-level `children()` API should only be introduced when an application use case requires direct access to all child handles.

---

# 7. Snapshot API

The normal public snapshot API exists at the document level.

```ts
const value =
  document.snapshot()
```

It returns the complete logical nested value of the document.

```ts
interface DocumentHandle<
  S extends AnySchema,
> {
  readonly root: HandleOf<S>

  snapshot(): ValueOf<S>
}
```

Subtree snapshots are not part of the initial public API.

They may later be added for:

* testing,
* debugging,
* copying subtrees,
* validation tools,
* integration boundaries.

Ordinary snapshots contain logical nested values and do not automatically include editor `nodeId` metadata.

---

# 8. Synchronous live editing

Handle reads and mutations are synchronous.

```ts
const value =
  stringHandle.value()

array.insert(0, newValue)
```

Stores must maintain a local live representation suitable for synchronous renderer access.

Loading and saving documents remain asynchronous repository operations.

```ts
const document =
  await repository.open(documentId)

await repository.save(document)
```

This separates:

```text
synchronous live editing
from
asynchronous persistence and loading
```

---

# 9. Store adapter visibility

The store adapter is hidden inside bound handles and the document handle.

Renderer and plugin code interact with:

* `ValueHandle`,
* schema-specific handles,
* semantic operations,
* `DocumentHandle`.

They do not receive the raw adapter or the raw store reference.

Store-specific functionality should only be exposed through explicit, dedicated APIs when required.

---

# 10. First-class semantic operations

Editor mutations are represented as first-class semantic operations.

```ts
const ArrayInsert =
  defineOperation({
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

    defaultImplementation(
      context,
      operation,
    ) {
      // Lower into store instructions.
    },
  })
```

Semantic operations represent editor intent.

Examples:

```ts
type SemanticOperation =
  | ArrayInsert
  | ArrayRemove
  | ArrayMove
  | StringSet
  | ObjectPropertySet
  | UnionVariantReplace
```

They are not tied to a specific storage implementation.

---

# 11. Public mutation API

Common operations are exposed as methods on schema-specific handles.

```ts
array.insert(index, value)

array.remove(index)

stringHandle.set(value)
```

Uncommon operations may be executed through `dispatch()`.

```ts
handle.dispatch(
  someUncommonOperation,
)
```

`dispatch()` is an advanced escape hatch rather than the default renderer API.

The operation target is supplied implicitly by the handle:

```ts
handle.dispatch(operation)
```

The operation itself does not need to contain the target node reference.

---

# 12. Explicit handle methods

Common methods are implemented explicitly.

```ts
class ArrayHandleImplementation<
  C extends AnySchema,
> implements ArrayHandle<C> {
  insert(
    index: number,
    value: ValueOf<C>,
  ) {
    return this.dispatch(
      ArrayInsert.create(
        index,
        value,
      ),
    )
  }

  remove(index: number) {
    return this.dispatch(
      ArrayRemove.create(index),
    )
  }
}
```

This approach provides:

* simple TypeScript types,
* predictable runtime behavior,
* strong autocomplete,
* an explicit public API,
* no dynamic proxy behavior.

The main drawback is forwarding boilerplate.

```ts
insert(index, value) {
  return this.dispatch(
    ArrayInsert.create(
      index,
      value,
    ),
  )
}
```

Reducing this boilerplate is a future challenge.

Possible future solutions include:

* schema compilation,
* mapped-type method binding,
* operation method generation,
* TypeScript code generation.

---

# 13. Operation return values

Mutation methods return operation-specific results.

```ts
const inserted =
  array.insert(index, value)

const removed =
  array.remove(index)

const result =
  stringHandle.set(value)
```

Each operation defines its own semantic return type.

```ts
interface ArrayInsertOperation<C> {
  result:
    Result<HandleOf<C>, ArrayInsertError>
}

interface ArrayRemoveOperation<C> {
  result:
    Result<RemovedValue<C>, ArrayRemoveError>
}

interface StringSetOperation {
  result:
    Result<void, StringSetError>
}
```

Operations are not forced into one generic return shape.

---

# 14. Failure model

Expected domain failures return typed results.

```ts
const result =
  array.insert(index, value)

if (!result.ok) {
  handleInsertError(
    result.error,
  )
}
```

Examples of expected failures:

* schema validation failure,
* permission rejection,
* an invalid operation in the current domain state,
* a rejected collaborative update.

Programmer and infrastructure errors throw exceptions.

Examples:

* missing adapter instruction,
* invalid adapter configuration,
* an impossible schema/store mismatch,
* using an operation with the wrong schema kind.

This creates the distinction:

```text
Expected domain failure
→ Result

Programming or infrastructure failure
→ exception
```

---

# 15. Semantic operations and store instructions

Semantic operations are separate from low-level store instructions.

Example semantic operation:

```text
ArrayInsert
```

Possible default lowering:

```text
AllocateValue
InsertReference
```

Complete flow:

```text
renderer
    ↓
ValueHandle method
    ↓
semantic operation
    ↓
store-specific override?
    ├── yes
    │     ↓
    │ specialized implementation
    │
    └── no
          ↓
    universal default implementation
          ↓
    store instruction program
          ↓
    store adapter
```

Semantic operations retain domain meaning.

Store instructions describe lower-level storage mechanics.

---

# 16. Universal default implementations

Each semantic operation has one universal default implementation.

Example:

```ts
const ArrayInsert =
  defineOperation({
    name: "array.insert",

    defaultImplementation(
      context,
      operation,
    ) {
      const childRef =
        context.allocateValue(
          context.schema.childSchema,
          operation.value,
        )

      return context.insertReference(
        context.ref,
        operation.index,
        childRef,
      )
    },
  })
```

A flat store may use this default directly.

A Yjs store may override the complete semantic operation.

```ts
yjsAdapter.override(
  ArrayInsert,
  (context, operation) => {
    context.yArray.insert(
      operation.index,
      [
        context.convertToYValue(
          operation.value,
        ),
      ],
    )
  },
)
```

The semantic meaning remains universal even if execution differs between stores.

---

# 17. Store instructions

Stores declare the lower-level instructions they support.

Possible starting instruction vocabulary:

```ts
type InstructionName =
  | "allocateValue"
  | "setScalar"
  | "insertReference"
  | "removeReference"
  | "replaceReference"
```

A store adapter may implement only a subset.

```ts
interface StoreAdapter<
  Supported extends InstructionName,
> {
  readonly handlers: {
    [K in Supported]:
      InstructionHandler<K>
  }
}
```

A default operation implementation declares which instructions it requires.

```ts
interface Program<
  Required extends InstructionName,
  Result,
> {
  readonly required: Required
}
```

An operation can be executed when the adapter either:

1. implements a direct semantic-operation override, or
2. implements all instructions required by the universal default.

---

# 18. Adapter compatibility

For now, adapter compatibility is validated at startup or when an unsupported operation is executed.

Example error:

```text
YjsStore cannot execute ObjectReplace:

- no direct override exists
- required instruction "replaceReference" is missing
```

Proving every override and fallback relationship entirely through the TypeScript type system is a future challenge.

Runtime validation is acceptable for the initial implementation.

---

# 19. Instruction granularity

The exact instruction vocabulary remains an open challenge.

Instructions must be:

* general enough for flat, nested, and Yjs stores,
* expressive enough for atomic mutations,
* independent of one specific storage representation,
* low-level enough to be reusable,
* high-level enough to avoid inefficient or unnatural lowering.

Potential levels include:

```text
Low-level:
- allocate record
- set field
- splice references

Medium-level:
- allocate value
- insert child
- replace scalar

High-level:
- insert array element
- replace union variant
```

The initial instruction set should remain small and evolve based on concrete store requirements.

---

# 20. Store adapter responsibilities

The store adapter owns storage-specific concerns.

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

Responsibilities include:

* resolving references,
* executing store instructions,
* direct semantic-operation overrides,
* subscriptions,
* transactions,
* node allocation,
* node removal,
* garbage collection,
* stable identity mapping,
* storage-specific optimization.

The adapter does not redefine:

* schema meaning,
* operation meaning,
* renderer behavior,
* logical validation rules,
* nested JSON serialization semantics.

---

# 21. `DocumentHandle`

A `DocumentHandle` exists above ordinary value handles.

```ts
interface DocumentHandle<
  S extends AnySchema,
> {
  readonly root: HandleOf<S>

  snapshot(): ValueOf<S>

  transaction<R>(
    callback: () => R,
  ): R
}
```

It owns document-level concerns such as:

* the root handle,
* transactions,
* document snapshots,
* document lifecycle,
* integration with the repository.

Node lookup by `nodeId` is not part of the initial public API.

It may be added later if a concrete application requirement appears.

Possible future API:

```ts
document.find(nodeId)

document.find(
  nodeId,
  expectedSchema,
)
```

---

# 22. Transactions

Transactions are exposed through the document handle.

```ts
document.transaction(() => {
  array.insert(0, first)
  array.insert(1, second)
})
```

Individual semantic operations are atomic.

Transactions group multiple operations into one larger atomic unit.

Nested transactions join the outer transaction.

```ts
document.transaction(() => {
  firstOperation()

  document.transaction(() => {
    secondOperation()
  })
})
```

The inner transaction does not create an independent commit boundary.

---

# 23. Transaction visibility

Subscribers observe only the final committed state of a transaction.

They do not observe intermediate mutations.

```text
transaction begins
  mutation A
  mutation B
  mutation C
transaction commits

subscriber receives one coherent update
```

This supports:

* atomic React rendering,
* coherent snapshots,
* batched collaboration updates,
* one undo entry per transaction,
* predictable derived state.

---

# 24. React subscription model

Core handle read methods are synchronous and non-reactive.

```ts
array.map(...)
stringHandle.value()
```

React subscriptions are explicit and implemented separately.

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

The core API therefore remains independent of React.

React integration should use `useSyncExternalStore` or an equivalent selector-based abstraction.

```ts
function useHandleSelector<
  S extends AnySchema,
  R,
>(
  handle: ValueHandle<S>,
  selector: (
    snapshot: SnapshotOf<S>,
  ) => R,
): R
```

A parent array renderer subscribes to structural information such as:

* child IDs,
* child order,
* array length.

A child renderer subscribes to its own value.

A string change should not rerender the array parent if the array structure remains unchanged.

An insertion should rerender the array parent because membership or order changed.

Store transactions should batch parent and child notifications into one coherent update.

---

# 25. Deleted handles

A retained handle becomes detached when its node is removed.

```ts
handle.isAttached()
```

Reads and writes through a detached handle fail with a typed stale-handle error.

```ts
type StaleHandleError = {
  type: "stale-handle"
  nodeId: NodeId
}
```

The detached handle retains its `nodeId` for diagnostics.

It does not silently return its previous value and does not automatically follow a replacement node.

---

# 26. Schema visibility

The concrete schema object is publicly available on the handle.

```ts
handle.schema
```

This supports:

* generic renderers,
* diagnostics,
* schema-aware tooling,
* operation construction,
* editor inspection,
* testing.

The schema is part of the typed handle contract.

---

# 27. Nested JSON codec boundary

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

Example logical document value:

```json
{
  "question": "What is 2 + 2?",
  "answers": [
    "3",
    "4",
    "5"
  ]
}
```

Internal stores may use:

* normalized flat nodes,
* mutable nested objects,
* Yjs structures.

The serialization boundary remains:

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
* migrations,
* validation,
* snapshots.

Live editing uses handles and semantic operations.

---

# 28. Schema compilation

Schemas may be compiled once into specialized runtime behavior.

```ts
const compiled =
  compileSchema(schema)

compiled.createHandle(...)
compiled.validate(...)
compiled.encode(...)
compiled.decode(...)
compiled.lowerOperation(...)
```

Compilation may:

* resolve semantic operation definitions,
* bind child schemas,
* create handle factories,
* collect instruction requirements,
* validate adapter compatibility,
* reduce registry lookups,
* isolate unavoidable TypeScript assertions.

This is a form of partial evaluation: schema-dependent work happens once rather than during every render or mutation.

---

# 29. Avoiding central switch statements

The architecture should avoid large central switch statements that must be modified whenever a schema or operation is added.

Adding a schema kind should not require editing separate central switches for:

* rendering,
* validation,
* storage,
* loading,
* saving,
* operation dispatch.

Useful mechanisms include:

* schema-local definitions,
* first-class operation objects,
* compiled schema handlers,
* operation registries,
* adapter override maps,
* store instruction handlers.

Some runtime dispatch is unavoidable, but it should be concentrated in registration and compilation infrastructure.

---

# 30. Static extensibility first

Schemas, operations, instructions, and adapters are statically known in the initial architecture.

This permits:

* closed TypeScript unions,
* explicit handle interfaces,
* exhaustive operation types,
* simpler schema compilation,
* stronger type inference,
* simpler adapter validation.

Dynamic plugin registration is a future feature.

It may later require:

* runtime registries,
* namespaced schema identifiers,
* namespaced operation identifiers,
* versioning,
* startup compatibility validation,
* fallback behavior for unknown schemas,
* weaker compile-time exhaustiveness.

---

# Open challenges

## 1. Instruction granularity

The correct level for store instructions remains undecided.

The instruction set should be derived from concrete requirements of:

* flat storage,
* nested storage,
* Yjs storage.

It should not prematurely assume one storage model.

## 2. Read API

The exact schema-specific read API remains open.

Questions include:

* Should `map()` be the only collection traversal API?
* Is `children()` needed for non-rendering applications?
* Should subtree snapshots be exposed?
* How should object properties expose handles?
* How should tuple positions expose handles?
* How should union variants expose handles?
* How fine-grained should selector snapshots be?

## 3. Handle method boilerplate

Explicit handle methods require forwarding code.

```ts
insert(index, value) {
  return this.dispatch(
    ArrayInsert.create(
      index,
      value,
    ),
  )
}
```

Potential future solutions include:

* code generation,
* schema compilation,
* operation-to-method binding,
* mapped types.

## 4. Compile-time adapter compatibility

The system does not initially prove at compile time that every semantic operation has either:

* a direct adapter override, or
* all instructions required by its universal default.

Startup or runtime validation is sufficient initially.

Compile-time verification remains a future design challenge.

---

# Future ideas

## Schema modules

A schema module could package all related definitions together.

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

This resembles an ML module because associated types and related behavior are packaged together.

It resembles a typeclass dictionary because a runtime object provides the behavior associated with a type.

## Code generation

Code generation could produce:

* value types,
* handle types,
* operation unions,
* handle forwarding methods,
* codecs,
* validators.

This may eliminate boilerplate and bypass TypeScript recursion limits.

## CQRS concepts

The architecture already separates:

```text
queries
commands
storage execution
```

Possible mapping:

```text
ValueHandle reads
→ queries

Semantic operations
→ commands

Optional operation log
→ future events
```

Full event sourcing is not required.

## Repository pattern

A repository may own asynchronous document lifecycle operations.

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

## Aggregate boundaries

Some structured values may form consistency boundaries.

Examples:

* an exercise containing a question and answer,
* a union whose active variant and value must change atomically,
* a tuple with fixed child positions.

Aggregates may later define where invariants must be enforced atomically.

## Lenses and optics

Lenses, prisms, and traversals may later provide reusable typed paths through:

* object schemas,
* tuple schemas,
* union schemas,
* collection schemas.

They are not required for the initial architecture.

---

# Condensed architecture

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

DocumentHandle
├── root handle
├── snapshot()
├── transaction()
└── document lifecycle

ValueHandle
├── schema
├── stable nodeId
├── hidden store reference
├── dispatch()
└── schema-specific API

SemanticOperation
├── editor intent
├── typed arguments
├── semantic result type
├── universal default implementation
└── required instructions

StoreInstruction
├── allocation
├── scalar mutation
├── reference mutation
└── structural mutation

StoreAdapter
├── instruction handlers
├── semantic-operation overrides
├── subscriptions
├── transactions
├── reference resolution
├── stable identity mapping
└── garbage collection

Repository
├── asynchronous loading
├── asynchronous saving
└── persistence lifecycle
```

# Final API direction

```ts
const document =
  await repository.open(
    documentId,
    documentSchema,
  )

const root =
  document.root

document.transaction(() => {
  root.answers.insert(
    0,
    "New answer",
  )

  root.question.set(
    "Updated question",
  )
})

const json =
  document.snapshot()

await repository.save(document)
```

The design prioritizes:

* store-independent renderers,
* stable logical node identity,
* explicit schema-specific APIs,
* fine-grained renderer reads,
* semantic operations,
* universal operation defaults,
* store-specific optimization,
* typed domain failures,
* synchronous live editing,
* asynchronous persistence,
* atomic transactions,
* static extensibility initially.
