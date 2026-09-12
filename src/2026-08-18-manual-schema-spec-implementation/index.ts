// Value types

export interface StringValue {
  get(): string
  set(value: string): void
}

export interface ArrayValue<T> {
  readonly length: number
  at(index: number): T
  map<R>(fn: (value: T, index: number) => R): R[]
}

export type Value = StringValue | ArrayValue<unknown>

// Schemas

export interface Schema<V extends Value = Value, JSONValue = unknown> {
  readonly kind: "string" | "array"
  readonly __value?: V
  readonly __jsonValue?: JSONValue
}

export type ValueOf<S extends Schema> = S extends Schema<infer V, unknown> ? V : never

export type JSONValueOf<S extends Schema> =
  S extends Schema<Value, infer JSONValue> ? JSONValue : never

export interface StringSchema extends Schema<StringValue, string> {
  readonly kind: "string"
}

export function string(): StringSchema {
  return { kind: "string" }
}

export interface ArraySchema<C extends Schema> extends Schema<
  ArrayValue<ValueOf<C>>,
  JSONValueOf<C>[]
> {
  readonly kind: "array"
  readonly element: C
}

export function array<C extends Schema>(element: C): ArraySchema<C> {
  return { kind: "array", element }
}

// Storage

type StoredValue<Ref> = string | readonly Ref[]

export abstract class Storage<Ref> {
  bind<S extends Schema>(schema: S, ref: Ref): ValueOf<S>
  bind(schema: Schema, ref: Ref): Value {
    if (schema.kind === "string") {
      return {
        get: () => this.string(ref),
        set: (value: string) => {
          this.string(ref)
          this.write(ref, value)
        },
      }
    }

    if (schema.kind === "array") {
      const element = (schema as ArraySchema<Schema>).element
      const readItems = () => this.array(ref)
      const bindItem = (item: Ref) => this.bind(element, item)

      return {
        get length() {
          return readItems().length
        },
        at(index: number) {
          const items = readItems()
          assertValidIndex(index, items.length)
          return bindItem(items[index]!)
        },
        map<R>(fn: (value: Value, index: number) => R) {
          return readItems().map((item, index) => fn(bindItem(item), index))
        },
      } satisfies ArrayValue<Value>
    }

    throw new Error(`Unsupported schema: ${schema.kind}`)
  }

  save<S extends Schema>(schema: S, json: JSONValueOf<S>): Ref {
    const ref = this.createValue(schema, json)
    this.onCreate(ref)
    return ref
  }

  load<S extends Schema>(schema: S, ref: Ref): JSONValueOf<S>
  load(schema: Schema, ref: Ref): unknown {
    if (schema.kind === "string") {
      return this.string(ref)
    }

    if (schema.kind === "array") {
      const element = (schema as ArraySchema<Schema>).element
      return this.array(ref).map((item) => this.load(element, item))
    }

    throw new Error(`Unsupported schema: ${schema.kind}`)
  }

  protected abstract read(ref: Ref): StoredValue<Ref>
  protected abstract write(ref: Ref, value: string): void
  protected abstract make(value: StoredValue<Ref>): Ref

  protected onCreate(_ref: Ref): void {}

  private createValue(schema: Schema, json: unknown): Ref {
    if (schema.kind === "string") {
      if (typeof json !== "string") {
        throw new TypeError("Expected string value")
      }

      return this.make(json)
    }

    if (schema.kind === "array") {
      if (!Array.isArray(json)) {
        throw new TypeError("Expected array value")
      }

      const element = (schema as ArraySchema<Schema>).element
      return this.make(json.map((value) => this.createValue(element, value)))
    }

    throw new Error(`Unsupported schema: ${schema.kind}`)
  }

  private string(ref: Ref): string {
    const value = this.read(ref)
    if (typeof value !== "string") {
      throw new TypeError("Reference is not string")
    }
    return value
  }

  private array(ref: Ref): readonly Ref[] {
    const value = this.read(ref)
    if (typeof value === "string") {
      throw new TypeError("Reference is not array")
    }
    return value
  }
}

function assertValidIndex(index: number, length: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= length) {
    throw new RangeError("Array index out of bounds")
  }
}

// Yjs storage

import * as Y from "yjs"

export type YNode = Y.Text | Y.Array<YNode>

export class YjsStorage extends Storage<YNode> {
  readonly doc: Y.Doc
  private readonly roots: Y.Array<YNode>

  constructor(doc = new Y.Doc()) {
    super()
    this.doc = doc
    this.roots = doc.getArray<YNode>("manual-schema-storage")
  }

  protected read(ref: YNode): StoredValue<YNode> {
    if (ref instanceof Y.Text) return ref.toString()
    if (ref instanceof Y.Array) return ref.toArray()
    throw new TypeError("Unknown reference")
  }

  protected write(ref: YNode, value: string): void {
    if (!(ref instanceof Y.Text)) {
      throw new TypeError("Reference is not string")
    }

    this.doc.transact(() => {
      ref.delete(0, ref.length)
      ref.insert(0, value)
    })
  }

  protected make(value: StoredValue<YNode>): YNode {
    if (typeof value === "string") return new Y.Text(value)

    const node = new Y.Array<YNode>()
    node.push([...value])
    return node
  }

  protected override onCreate(ref: YNode): void {
    this.roots.push([ref])
  }
}

// Example usage

export const tags = array(string())

function showTagExample<Ref>(name: string, storage: Storage<Ref>): void {
  const ref = storage.save(tags, ["schema", "storage"])
  const values = storage.bind(tags, ref)

  values.at(0).set(`${name} schema`)
  console.log(
    `${name} tags:`,
    values.map((tag) => tag.get()),
  )
  console.log(`${name} JSON:`, storage.load(tags, ref))
}

const storage = new YjsStorage()
showTagExample("Yjs", storage)
console.log("Yjs document:", storage.doc.toJSON())
