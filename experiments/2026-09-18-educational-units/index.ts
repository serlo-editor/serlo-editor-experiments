// Schemas

export interface StringValue {
  get(): string
  set(value: string): void
}

export interface ArrayValue<T> {
  readonly length: number
  at(index: number): T
  map<R>(fn: (value: T, index: number) => R): R[]
}

export type SchemaFields = Record<string, Schema>
export type ObjectValue<Fields extends SchemaFields> = {
  readonly [Key in keyof Fields]: ValueOf<Fields[Key]>
}

export interface Schema<Value = unknown, JSONValue = unknown> {
  readonly kind: string
  readonly __value?: Value
  readonly __jsonValue?: JSONValue
}

export type ValueOf<S extends Schema> = S extends Schema<infer Value, unknown> ? Value : never
export type JSONValueOf<S extends Schema> =
  S extends Schema<unknown, infer JSONValue> ? JSONValue : never

export interface StringSchema extends Schema<StringValue, string> {
  readonly kind: "string"
}

export interface ArraySchema<Element extends Schema> extends Schema<
  ArrayValue<ValueOf<Element>>,
  JSONValueOf<Element>[]
> {
  readonly kind: "array"
  readonly element: Element
}

export interface ObjectSchema<Fields extends SchemaFields> extends Schema<
  ObjectValue<Fields>,
  { [Key in keyof Fields]: JSONValueOf<Fields[Key]> }
> {
  readonly kind: "object"
  readonly fields: Fields
}

export const string = (): StringSchema => ({ kind: "string" })
export const array = <Element extends Schema>(element: Element): ArraySchema<Element> => ({
  kind: "array",
  element,
})
export const object = <const Fields extends SchemaFields>(
  fields: Fields,
): ObjectSchema<Fields> => ({ kind: "object", fields })

// Storage

export type StorageNode<Ref> =
  | { kind: "string"; value: string }
  | { kind: "array"; children: Ref[] }
  | { kind: "object"; fields: Record<string, Ref> }

export interface StorageAdapter<Ref> {
  create(node: StorageNode<Ref>): Ref
  get(reference: Ref): StorageNode<Ref>
}

type Operation = "bind" | "create" | "load"

interface SchemaExtension<Ref> {
  bind(schema: Schema, reference: Ref): unknown
  create(schema: Schema, value: unknown): Ref
  load(schema: Schema, reference: Ref): unknown
}

export function bind<Ref, S extends Schema>(
  schema: S,
  storage: StorageAdapter<Ref>,
  reference: Ref,
  extension?: SchemaExtension<Ref>,
): ValueOf<S> {
  return walk("bind", schema, reference, storage, extension) as ValueOf<S>
}

export function create<Ref, S extends Schema>(
  schema: S,
  storage: StorageAdapter<Ref>,
  value: JSONValueOf<S>,
  extension?: SchemaExtension<Ref>,
): Ref {
  return walk("create", schema, value, storage, extension) as Ref
}

export function load<Ref, S extends Schema>(
  schema: S,
  storage: StorageAdapter<Ref>,
  reference: Ref,
  extension?: SchemaExtension<Ref>,
): JSONValueOf<S> {
  return walk("load", schema, reference, storage, extension) as JSONValueOf<S>
}

function walk<Ref>(
  operation: Operation,
  schema: Schema,
  input: unknown,
  storage: StorageAdapter<Ref>,
  extension?: SchemaExtension<Ref>,
): unknown {
  const next = (childSchema: Schema, childInput: unknown) =>
    walk(operation, childSchema, childInput, storage, extension)

  if (schema.kind === "string") {
    if (operation === "create") {
      if (typeof input !== "string") throw new TypeError("Expected string value")
      return storage.create({ kind: "string", value: input })
    }

    const reference = input as Ref
    const node = getNode(storage, reference, "string")
    if (operation === "load") return node.value
    return {
      get: () => getNode(storage, reference, "string").value,
      set: (value: string) => {
        getNode(storage, reference, "string").value = value
      },
    } satisfies StringValue
  }

  if (schema.kind === "array") {
    const element = (schema as ArraySchema<Schema>).element
    if (operation === "create") {
      if (!Array.isArray(input)) throw new TypeError("Expected array value")
      return storage.create({
        kind: "array",
        children: input.map((value) => next(element, value)) as Ref[],
      })
    }

    const reference = input as Ref
    const children = () => getNode(storage, reference, "array").children
    if (operation === "load") return children().map((child) => next(element, child))
    return {
      get length() {
        return children().length
      },
      at: (index: number) => next(element, arrayItem(children(), index)),
      map: <Result>(fn: (value: unknown, index: number) => Result) =>
        children().map((child, index) => fn(next(element, child), index)),
    }
  }

  if (schema.kind === "object") {
    const fields = (schema as ObjectSchema<SchemaFields>).fields
    if (operation === "create") {
      if (!isRecord(input)) throw new TypeError("Expected object value")
      return storage.create({
        kind: "object",
        fields: mapFields(fields, (field, name) => next(field, input[name])) as Record<string, Ref>,
      })
    }

    const references = getNode(storage, input as Ref, "object").fields
    return mapFields(fields, (field, name) => next(field, objectField(references, name)))
  }

  if (!extension) throw new Error(`Unsupported schema: ${schema.kind}`)
  if (operation === "create") return extension.create(schema, input)
  if (operation === "bind") return extension.bind(schema, input as Ref)
  return extension.load(schema, input as Ref)
}

function getNode<Ref, Kind extends StorageNode<Ref>["kind"]>(
  storage: StorageAdapter<Ref>,
  reference: Ref,
  kind: Kind,
): Extract<StorageNode<Ref>, { kind: Kind }> {
  const node = storage.get(reference)
  if (node.kind !== kind) throw new TypeError(`Reference is not ${kind}`)
  return node as Extract<StorageNode<Ref>, { kind: Kind }>
}

const mapFields = <Input, Output>(
  fields: Record<string, Input>,
  map: (value: Input, name: string) => Output,
): Record<string, Output> =>
  Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, map(value, name)]))

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const objectField = <Ref>(fields: Record<string, Ref>, name: string): Ref => {
  if (!(name in fields)) throw new TypeError(`Missing object field: ${name}`)
  return fields[name]!
}

const arrayItem = <Ref>(items: Ref[], index: number): Ref => {
  if (!Number.isInteger(index) || index < 0 || index >= items.length) {
    throw new RangeError("Array index out of bounds")
  }
  return items[index]!
}

// Educational units

type AnyObjectSchema = ObjectSchema<SchemaFields>

export type UnitJSON<Definition extends EducationalUnitDefinition> = {
  id: string
  type: Definition["type"]
} & JSONValueOf<Definition["schema"]>

export type EducationalUnitValue<Definition extends EducationalUnitDefinition> = {
  readonly id: string
  readonly type: Definition["type"]
  readonly value: ValueOf<Definition["schema"]>
  render(): ReturnType<Definition["render"]>
}

export interface EducationalUnitDefinition<
  Type extends string = string,
  UnitSchema extends AnyObjectSchema = AnyObjectSchema,
  Context = unknown,
  Node = unknown,
> {
  readonly type: Type
  readonly schema: UnitSchema
  readonly storageSchema: AnyObjectSchema
  render(
    unit: EducationalUnitValue<EducationalUnitDefinition<Type, UnitSchema, Context, Node>>,
    context: Context,
  ): Node
}

type AnyUnitDefinition = EducationalUnitDefinition

type UnitValueOf<Definition extends AnyUnitDefinition> = Definition extends AnyUnitDefinition
  ? EducationalUnitValue<Definition>
  : never

export interface ChildSchema<Definitions extends readonly AnyUnitDefinition[]> extends Schema<
  UnitValueOf<Definitions[number]>,
  UnitJSON<Definitions[number]>
> {
  readonly kind: "child"
  readonly units: Definitions
}

export const educationalUnit = <
  const Type extends string,
  const UnitSchema extends AnyObjectSchema,
  Context = unknown,
  Node = unknown,
>(definition: {
  type: Type
  schema: UnitSchema
  render: (
    unit: EducationalUnitValue<EducationalUnitDefinition<Type, UnitSchema, Context, Node>>,
    context: Context,
  ) => Node
}): EducationalUnitDefinition<Type, UnitSchema, Context, Node> => {
  if ("id" in definition.schema.fields || "type" in definition.schema.fields) {
    throw new TypeError("Educational unit schema fields id and type are reserved")
  }
  return {
    ...definition,
    storageSchema: object({ id: string(), type: string(), ...definition.schema.fields }),
  }
}

export const child = <const Definitions extends readonly AnyUnitDefinition[]>(
  ...units: Definitions
): ChildSchema<Definitions> => {
  if (units.length === 0) throw new TypeError("child() needs at least one unit definition")
  return { kind: "child", units }
}

const unitHeader = object({ id: string(), type: string() })

export class EducationalUnitStorage<Ref, Definitions extends readonly AnyUnitDefinition[]> {
  private readonly storage: StorageAdapter<Ref>
  private readonly definitions = new Map<string, AnyUnitDefinition>()

  constructor(storage: StorageAdapter<Ref>, units: Definitions) {
    this.storage = storage
    for (const unit of units) {
      if (this.definitions.has(unit.type)) {
        throw new TypeError(`Duplicate educational unit type: ${unit.type}`)
      }
      this.definitions.set(unit.type, unit)
    }
  }

  save<Definition extends Definitions[number]>(unit: UnitJSON<Definition>): Ref {
    const definition = this.definitionForJSON(unit)
    return create(definition.storageSchema, this.storage, unit, this.extension(undefined))
  }

  bind<Context>(reference: Ref, context: Context): UnitValueOf<Definitions[number]> {
    return this.bindUnit(reference, context) as UnitValueOf<Definitions[number]>
  }

  load(reference: Ref): UnitJSON<Definitions[number]> {
    return this.loadUnit(reference) as UnitJSON<Definitions[number]>
  }

  private extension(context: unknown): SchemaExtension<Ref> {
    return {
      bind: (schema, reference) => this.bindChild(schema, reference, context),
      create: (schema, value) => this.createChild(schema, value),
      load: (schema, reference) => this.loadChild(schema, reference),
    }
  }

  private bindUnit(reference: Ref, context: unknown): EducationalUnitValue<AnyUnitDefinition> {
    const { id, type, definition } = this.metadata(reference)
    const value = bind(definition.schema, this.storage, reference, this.extension(context))
    const unit = {
      id,
      type,
      value,
      render: () => definition.render(unit, context),
    } as EducationalUnitValue<AnyUnitDefinition>
    return unit
  }

  private bindChild(schema: Schema, reference: Ref, context: unknown): unknown {
    const unit = this.bindUnit(reference, context)
    this.assertAllowed(schema, unit.type)
    return unit
  }

  private createChild(schema: Schema, value: unknown): Ref {
    const definition = this.definitionForJSON(value)
    this.assertAllowed(schema, definition.type)
    return create(
      definition.storageSchema,
      this.storage,
      value as Record<string, unknown>,
      this.extension(undefined),
    )
  }

  private loadUnit(reference: Ref): UnitJSON<AnyUnitDefinition> {
    const { id, type, definition } = this.metadata(reference)
    const fields = load(definition.schema, this.storage, reference, this.extension(undefined))
    return { id, type, ...fields }
  }

  private loadChild(schema: Schema, reference: Ref): UnitJSON<AnyUnitDefinition> {
    const unit = this.loadUnit(reference)
    this.assertAllowed(schema, unit.type)
    return unit
  }

  private metadata(reference: Ref): {
    id: string
    type: string
    definition: AnyUnitDefinition
  } {
    const { id, type } = load(unitHeader, this.storage, reference)
    return { id, type, definition: this.definition(type) }
  }

  private definitionForJSON(value: unknown): AnyUnitDefinition {
    if (!isRecord(value) || typeof value.id !== "string" || typeof value.type !== "string") {
      throw new TypeError("Educational unit needs string id and type")
    }
    return this.definition(value.type)
  }

  private definition(type: string): AnyUnitDefinition {
    const definition = this.definitions.get(type)
    if (!definition) throw new TypeError(`Unknown educational unit type: ${type}`)
    return definition
  }

  private assertAllowed(schema: Schema, type: string): void {
    if (schema.kind !== "child") throw new Error(`Unsupported schema: ${schema.kind}`)
    const childSchema = schema as ChildSchema<readonly AnyUnitDefinition[]>
    if (!childSchema.units.some((unit) => unit.type === type)) {
      throw new TypeError(`Unit type ${type} is not allowed in this child field`)
    }
  }
}

export const createEducationalUnitStorage = <
  Ref,
  const Definitions extends readonly AnyUnitDefinition[],
>(options: {
  storage: StorageAdapter<Ref>
  units: Definitions
}): EducationalUnitStorage<Ref, Definitions> =>
  new EducationalUnitStorage(options.storage, options.units)

// Example adapters

type FlatReference = string & { readonly __flatReference: unique symbol }

export class FlatStorageAdapter implements StorageAdapter<FlatReference> {
  private readonly nodes = new Map<FlatReference, StorageNode<FlatReference>>()

  create(node: StorageNode<FlatReference>): FlatReference {
    const reference = `node:${this.nodes.size}` as FlatReference
    this.nodes.set(reference, node)
    return reference
  }

  get(reference: FlatReference): StorageNode<FlatReference> {
    const node = this.nodes.get(reference)
    if (!node) throw new Error("Unknown reference")
    return node
  }
}

type ObjectReference = { readonly node: StorageNode<ObjectReference> }

export class ObjectStorageAdapter implements StorageAdapter<ObjectReference> {
  create(node: StorageNode<ObjectReference>): ObjectReference {
    return { node }
  }

  get(reference: ObjectReference): StorageNode<ObjectReference> {
    return reference.node
  }
}

// Executable examples

type DemoContext = { readonly prefix: string }

const text = educationalUnit({
  type: "text",
  schema: object({ text: string() }),
  render(unit, context: DemoContext) {
    return `${context.prefix}text:${unit.value.text.get()}`
  },
})

const image = educationalUnit({
  type: "image",
  schema: object({ url: string() }),
  render(unit, context: DemoContext) {
    return `${context.prefix}image:${unit.value.url.get()}`
  },
})

const exercise = educationalUnit({
  type: "exercise",
  schema: object({
    title: string(),
    question: child(text),
    answer: child(text, image),
  }),
  render(unit, context: DemoContext) {
    return `${context.prefix}exercise:${unit.value.title.get()} [${unit.value.question.render()}] [${unit.value.answer.render()}]`
  },
})

const exerciseJSON = {
  id: "exercise-1",
  type: "exercise" as const,
  title: "Pythagoras",
  question: { id: "text-1", type: "text" as const, text: "What is c?" },
  answer: { id: "image-1", type: "image" as const, url: "triangle.svg" },
}

const runExample = <Ref>(storage: StorageAdapter<Ref>) => {
  const units = createEducationalUnitStorage({
    storage,
    units: [text, image, exercise],
  })
  const reference = units.save(exerciseJSON)
  const rendered = units.bind(reference, { prefix: "render " }).render()
  const loaded = units.load(reference)

  assert(
    rendered === "render exercise:Pythagoras [render text:What is c?] [render image:triangle.svg]",
    "child render failed",
  )
  assert(JSON.stringify(loaded) === JSON.stringify(exerciseJSON), "save/load changed unit JSON")
  return { rendered, loaded }
}

const flatExample = runExample(new FlatStorageAdapter())
const objectExample = runExample(new ObjectStorageAdapter())
assert(
  JSON.stringify(flatExample) === JSON.stringify(objectExample),
  "adapters expose different unit APIs",
)
console.log(flatExample)

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
