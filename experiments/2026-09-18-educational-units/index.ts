// Schemas and storage-backed values

export interface StringValue {
  get(): string
  set(value: string): void
}

export interface ArrayValue<T> {
  readonly length: number
  at(index: number): T
  map<R>(fn: (value: T, index: number) => R): R[]
}

export type ObjectValue<Fields extends SchemaFields> = {
  readonly [Key in keyof Fields]: ValueOf<Fields[Key]>
}

export interface Schema<Value = unknown, JSONValue = unknown> {
  readonly kind: string
  readonly __value?: Value
  readonly __jsonValue?: JSONValue
}

export type SchemaFields = Record<string, Schema>

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

// StorageAdapter: references and primitive storage mechanics only.

export interface StorageAdapter<Ref> {
  attach(reference: Ref): void
  createString(value: string): Ref
  getString(reference: Ref): string
  setString(reference: Ref, value: string): void
  createArray(children: Ref[]): Ref
  getArrayReferences(reference: Ref): Ref[]
  createObject(fields: Record<string, Ref>): Ref
  getObjectReferences(reference: Ref): Record<string, Ref>
}

interface SchemaExtension<Ref> {
  bind(schema: Schema, reference: Ref): unknown
  save(schema: Schema, value: unknown): Ref
  load(schema: Schema, reference: Ref): unknown
}

// Storage: maps ordinary schemas to references. Unknown schema kinds belong to
// higher layers through SchemaExtension; Storage knows no unit definitions.
export class Storage<Ref> {
  private readonly adapter: StorageAdapter<Ref>

  constructor(adapter: StorageAdapter<Ref>) {
    this.adapter = adapter
  }

  bind<S extends Schema>(schema: S, reference: Ref, extension?: SchemaExtension<Ref>): ValueOf<S>
  bind(schema: Schema, reference: Ref, extension?: SchemaExtension<Ref>): unknown {
    if (schema.kind === "string") {
      return {
        get: () => this.adapter.getString(reference),
        set: (value: string) => this.adapter.setString(reference, value),
      } satisfies StringValue
    }

    if (schema.kind === "array") {
      const arraySchema = schema as ArraySchema<Schema>
      const references = () => this.adapter.getArrayReferences(reference)

      return {
        get length() {
          return references().length
        },
        at: (index: number) =>
          this.bind(arraySchema.element, referenceAt(references(), index), extension),
        map: <Result>(fn: (value: unknown, index: number) => Result) =>
          references().map((child, index) =>
            fn(this.bind(arraySchema.element, child, extension), index),
          ),
      }
    }

    if (schema.kind === "object") {
      const objectSchema = schema as ObjectSchema<SchemaFields>
      const references = this.adapter.getObjectReferences(reference)
      const value: Record<string, unknown> = {}

      for (const [name, fieldSchema] of Object.entries(objectSchema.fields)) {
        value[name] = this.bind(fieldSchema, fieldReference(references, name), extension)
      }

      return value
    }

    if (extension) return extension.bind(schema, reference)
    throw new Error(`Unsupported schema: ${schema.kind}`)
  }

  save<S extends Schema>(schema: S, value: JSONValueOf<S>, extension?: SchemaExtension<Ref>): Ref
  save(schema: Schema, value: unknown, extension?: SchemaExtension<Ref>): Ref {
    const reference = this.create(schema, value, extension)
    this.adapter.attach(reference)
    return reference
  }

  create<S extends Schema>(schema: S, value: JSONValueOf<S>, extension?: SchemaExtension<Ref>): Ref
  create(schema: Schema, value: unknown, extension?: SchemaExtension<Ref>): Ref {
    if (schema.kind === "string") {
      if (typeof value !== "string") throw new TypeError("Expected string value")
      return this.adapter.createString(value)
    }

    if (schema.kind === "array") {
      if (!Array.isArray(value)) throw new TypeError("Expected array value")
      const arraySchema = schema as ArraySchema<Schema>
      return this.adapter.createArray(
        value.map((element) => this.create(arraySchema.element, element, extension)),
      )
    }

    if (schema.kind === "object") {
      if (!isRecord(value)) throw new TypeError("Expected object value")
      const objectSchema = schema as ObjectSchema<SchemaFields>
      const fields: Record<string, Ref> = {}

      for (const [name, fieldSchema] of Object.entries(objectSchema.fields)) {
        fields[name] = this.create(fieldSchema, value[name], extension)
      }

      return this.adapter.createObject(fields)
    }

    if (extension) return extension.save(schema, value)
    throw new Error(`Unsupported schema: ${schema.kind}`)
  }

  load<S extends Schema>(
    schema: S,
    reference: Ref,
    extension?: SchemaExtension<Ref>,
  ): JSONValueOf<S>
  load(schema: Schema, reference: Ref, extension?: SchemaExtension<Ref>): unknown {
    if (schema.kind === "string") return this.adapter.getString(reference)

    if (schema.kind === "array") {
      const arraySchema = schema as ArraySchema<Schema>
      return this.adapter
        .getArrayReferences(reference)
        .map((child) => this.load(arraySchema.element, child, extension))
    }

    if (schema.kind === "object") {
      const objectSchema = schema as ObjectSchema<SchemaFields>
      const references = this.adapter.getObjectReferences(reference)
      const value: Record<string, unknown> = {}

      for (const [name, fieldSchema] of Object.entries(objectSchema.fields)) {
        value[name] = this.load(fieldSchema, fieldReference(references, name), extension)
      }

      return value
    }

    if (extension) return extension.load(schema, reference)
    throw new Error(`Unsupported schema: ${schema.kind}`)
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const fieldReference = <Ref>(fields: Record<string, Ref>, name: string): Ref => {
  const reference = fields[name]
  if (reference === undefined) throw new TypeError(`Missing object field: ${name}`)
  return reference
}

const referenceAt = <Ref>(references: Ref[], index: number): Ref => {
  const reference = references[index]
  if (reference === undefined) throw new RangeError("Array index out of bounds")
  return reference
}

// Educational units

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
  Fields extends SchemaFields = SchemaFields,
  Context = unknown,
  Node = unknown,
> {
  readonly type: Type
  readonly schema: ObjectSchema<Fields>
  render(
    unit: EducationalUnitValue<EducationalUnitDefinition<Type, Fields, Context, Node>>,
    context: Context,
  ): Node
}

type UnitValueOf<Definition extends EducationalUnitDefinition> =
  Definition extends EducationalUnitDefinition ? EducationalUnitValue<Definition> : never

export interface ChildSchema<
  Definitions extends readonly EducationalUnitDefinition[],
> extends Schema<UnitValueOf<Definitions[number]>, UnitJSON<Definitions[number]>> {
  readonly kind: "child"
  readonly units: Definitions
}

export const educationalUnit = <
  const Type extends string,
  const Fields extends SchemaFields,
  Context = unknown,
  Node = unknown,
>(definition: {
  type: Type
  schema: ObjectSchema<Fields>
  render: (
    unit: EducationalUnitValue<EducationalUnitDefinition<Type, Fields, Context, Node>>,
    context: Context,
  ) => Node
}): EducationalUnitDefinition<Type, Fields, Context, Node> => definition

export const child = <const Definitions extends readonly EducationalUnitDefinition[]>(
  ...units: Definitions
): ChildSchema<Definitions> => {
  if (units.length === 0) throw new TypeError("child() needs at least one unit definition")
  return { kind: "child", units }
}

export class EducationalUnitStorage<Ref, Definitions extends readonly EducationalUnitDefinition[]> {
  private readonly definitions = new Map<string, EducationalUnitDefinition>()
  private readonly extension: SchemaExtension<Ref>
  private readonly storage: Storage<Ref>

  constructor(storage: Storage<Ref>, units: Definitions) {
    this.storage = storage
    for (const definition of units) {
      if (definition.type === "id" || definition.type === "type") {
        throw new TypeError(`Reserved educational unit type: ${definition.type}`)
      }
      if ("id" in definition.schema.fields || "type" in definition.schema.fields) {
        throw new TypeError("Educational unit schema fields id and type are reserved")
      }
      if (this.definitions.has(definition.type)) {
        throw new TypeError(`Duplicate educational unit type: ${definition.type}`)
      }
      this.definitions.set(definition.type, definition)
    }

    this.extension = {
      bind: (schema, reference) => this.bindChild(schema, reference, undefined),
      save: (schema, value) => this.createChild(schema, value),
      load: (schema, reference) => this.loadChild(schema, reference),
    }
  }

  save<Definition extends Definitions[number]>(unit: UnitJSON<Definition>): Ref {
    const definition = this.definitionForJSON(unit)
    return this.storage.save(this.schemaFor(definition), unit, this.extension)
  }

  bind<Context>(reference: Ref, context: Context): UnitValueOf<Definitions[number]> {
    return this.bindUnit(reference, context) as UnitValueOf<Definitions[number]>
  }

  load(reference: Ref): UnitJSON<Definitions[number]> {
    return this.loadUnit(reference) as UnitJSON<Definitions[number]>
  }

  private bindChild<Context>(schema: Schema, reference: Ref, context: Context): unknown {
    if (schema.kind !== "child") throw new Error(`Unsupported schema: ${schema.kind}`)
    const childSchema = schema as ChildSchema<readonly EducationalUnitDefinition[]>
    const unit = this.bindUnit(reference, context)

    if (!childSchema.units.some((definition) => definition.type === unit.type)) {
      throw new TypeError(`Unit type ${unit.type} is not allowed in this child field`)
    }

    return unit
  }

  private bindUnit<Context>(
    reference: Ref,
    context: Context,
  ): EducationalUnitValue<EducationalUnitDefinition> {
    const definition = this.definitionForReference(reference)
    const bound = this.storage.bind(this.schemaFor(definition), reference, {
      ...this.extension,
      bind: (schema, childReference) => this.bindChild(schema, childReference, context),
    }) as ObjectValue<SchemaFields>
    const unit = {
      id: (bound.id as StringValue).get(),
      type: definition.type,
      value: omitUnitFields(bound),
      render: () => definition.render(unit, context),
    } as EducationalUnitValue<EducationalUnitDefinition>

    return unit
  }

  private createChild(schema: Schema, value: unknown): Ref {
    if (schema.kind !== "child") throw new Error(`Unsupported schema: ${schema.kind}`)
    const childSchema = schema as ChildSchema<readonly EducationalUnitDefinition[]>
    if (!isRecord(value)) throw new TypeError("Expected educational unit object")
    const definition = this.definitionForJSON(value)

    if (!childSchema.units.some((unit) => unit.type === definition.type)) {
      throw new TypeError(`Unit type ${definition.type} is not allowed in this child field`)
    }

    return this.storage.create(this.schemaFor(definition), value, this.extension)
  }

  private loadChild(schema: Schema, reference: Ref): unknown {
    if (schema.kind !== "child") throw new Error(`Unsupported schema: ${schema.kind}`)
    const childSchema = schema as ChildSchema<readonly EducationalUnitDefinition[]>
    const value = this.loadUnit(reference)

    if (!childSchema.units.some((definition) => definition.type === value.type)) {
      throw new TypeError(`Unit type ${value.type} is not allowed in this child field`)
    }

    return value
  }

  private loadUnit(reference: Ref): UnitJSON<EducationalUnitDefinition> {
    const definition = this.definitionForReference(reference)
    return this.storage.load(
      this.schemaFor(definition),
      reference,
      this.extension,
    ) as UnitJSON<EducationalUnitDefinition>
  }

  private definitionForReference(reference: Ref): EducationalUnitDefinition {
    const envelope = this.storage.load(object({ id: string(), type: string() }), reference)
    return this.definitionForJSON(envelope)
  }

  private definitionForJSON(value: unknown): EducationalUnitDefinition {
    if (!isRecord(value) || typeof value.id !== "string" || typeof value.type !== "string") {
      throw new TypeError("Educational unit needs string id and type")
    }
    const definition = this.definitions.get(value.type)
    if (!definition) throw new TypeError(`Unknown educational unit type: ${value.type}`)
    return definition
  }

  private schemaFor(definition: EducationalUnitDefinition): ObjectSchema<SchemaFields> {
    return object({ id: string(), type: string(), ...definition.schema.fields })
  }
}

const omitUnitFields = (value: ObjectValue<SchemaFields>): unknown => {
  const { id: _id, type: _type, ...fields } = value
  return fields
}

export const createEducationalUnitStorage = <
  Ref,
  const Definitions extends readonly EducationalUnitDefinition[],
>(options: {
  storage: Storage<Ref>
  units: Definitions
}): EducationalUnitStorage<Ref, Definitions> =>
  new EducationalUnitStorage(options.storage, options.units)

// Two adapters with different reference representations.

type FlatReference = string & { readonly __flatReference: unique symbol }
type FlatNode =
  | { kind: "string"; value: string }
  | { kind: "array"; children: FlatReference[] }
  | { kind: "object"; fields: Record<string, FlatReference> }

export class FlatStorageAdapter implements StorageAdapter<FlatReference> {
  private readonly nodes = new Map<FlatReference, FlatNode>()
  private nextId = 0

  attach(_reference: FlatReference): void {}

  createString(value: string): FlatReference {
    return this.add({ kind: "string", value })
  }

  getString(reference: FlatReference): string {
    const node = this.node(reference)
    if (node.kind !== "string") throw new TypeError("Reference is not string")
    return node.value
  }

  setString(reference: FlatReference, value: string): void {
    const node = this.node(reference)
    if (node.kind !== "string") throw new TypeError("Reference is not string")
    node.value = value
  }

  createArray(children: FlatReference[]): FlatReference {
    return this.add({ kind: "array", children: [...children] })
  }

  getArrayReferences(reference: FlatReference): FlatReference[] {
    const node = this.node(reference)
    if (node.kind !== "array") throw new TypeError("Reference is not array")
    return [...node.children]
  }

  createObject(fields: Record<string, FlatReference>): FlatReference {
    return this.add({ kind: "object", fields: { ...fields } })
  }

  getObjectReferences(reference: FlatReference): Record<string, FlatReference> {
    const node = this.node(reference)
    if (node.kind !== "object") throw new TypeError("Reference is not object")
    return { ...node.fields }
  }

  private add(node: FlatNode): FlatReference {
    const reference = `node:${this.nextId++}` as FlatReference
    this.nodes.set(reference, node)
    return reference
  }

  private node(reference: FlatReference): FlatNode {
    const node = this.nodes.get(reference)
    if (!node) throw new Error("Unknown reference")
    return node
  }
}

type ObjectReference = { readonly node: ObjectNode }
type ObjectNode =
  | { kind: "string"; value: string }
  | { kind: "array"; children: ObjectReference[] }
  | { kind: "object"; fields: Record<string, ObjectReference> }

export class ObjectStorageAdapter implements StorageAdapter<ObjectReference> {
  attach(_reference: ObjectReference): void {}

  createString(value: string): ObjectReference {
    return { node: { kind: "string", value } }
  }

  getString(reference: ObjectReference): string {
    if (reference.node.kind !== "string") throw new TypeError("Reference is not string")
    return reference.node.value
  }

  setString(reference: ObjectReference, value: string): void {
    if (reference.node.kind !== "string") throw new TypeError("Reference is not string")
    reference.node.value = value
  }

  createArray(children: ObjectReference[]): ObjectReference {
    return { node: { kind: "array", children: [...children] } }
  }

  getArrayReferences(reference: ObjectReference): ObjectReference[] {
    if (reference.node.kind !== "array") throw new TypeError("Reference is not array")
    return [...reference.node.children]
  }

  createObject(fields: Record<string, ObjectReference>): ObjectReference {
    return { node: { kind: "object", fields: { ...fields } } }
  }

  getObjectReferences(reference: ObjectReference): Record<string, ObjectReference> {
    if (reference.node.kind !== "object") throw new TypeError("Reference is not object")
    return { ...reference.node.fields }
  }
}

// Executable example: child rendering, union dispatch, adapter-independent API,
// and exact flat save/load shape.

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

const runExample = <Ref>(adapter: StorageAdapter<Ref>) => {
  const units = createEducationalUnitStorage({
    storage: new Storage(adapter),
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
