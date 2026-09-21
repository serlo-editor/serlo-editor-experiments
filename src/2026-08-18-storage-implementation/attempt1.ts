import * as Y from "yjs"

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
  visit<Input, Output>(visitor: SchemaVisitor<Input, Output>, input: Input): Output
}

export type ValueOf<S extends Schema> = S extends Schema<infer V, unknown> ? V : never

export type JSONValueOf<S extends Schema> =
  S extends Schema<Value, infer JSONValue> ? JSONValue : never

export interface SchemaVisitor<Input, Output> {
  string(schema: StringSchema, input: Input): Output
  array(schema: ArraySchema<Schema>, input: Input): Output
}

export interface StringSchema extends Schema<StringValue, string> {
  readonly kind: "string"
}

export function string(): StringSchema {
  return {
    kind: "string",
    visit(visitor, input) {
      return visitor.string(this, input)
    },
  }
}

export interface ArraySchema<C extends Schema> extends Schema<
  ArrayValue<ValueOf<C>>,
  JSONValueOf<C>[]
> {
  readonly kind: "array"
  readonly element: C
}

export function array<C extends Schema>(element: C): ArraySchema<C> {
  return {
    kind: "array",
    element,
    visit(visitor, input) {
      return visitor.array(this, input)
    },
  }
}

// Storage

type StorageRef = unknown & { __storageRef: true }

interface StringStorageAdapter<Ref extends StorageRef> {
  create(value: string): Ref
  get(reference: Ref): string
  set(refernece: Ref, value: string): void
}

interface ArrayStorageAdapter<Ref extends StorageRef, ElementRef extends StorageRef> {
  create(children: ElementRef[]): Ref
  getElementReferences(reference: Ref): ElementRef[]
}

interface StorageAdapter<StringRef extends StorageRef, ArrayRef extends StorageRef> {
  string(): StringStorageAdapter<StringRef>
  array(): ArrayStorageAdapter<ArrayRef, StringRef | ArrayRef>
  attach(reference: StringRef | ArrayRef): void
}

export class Storage<Ref extends StorageRef = StorageRef> {
  constructor(private adapter: StorageAdapter<Ref, Ref>) {}

  bind<S extends Schema>(schema: S, reference: Ref): ValueOf<S>
  bind(schema: Schema, reference: Ref): Value {
    const visitor: SchemaVisitor<Ref, Value> = {
      string: (_schema, ref) => ({
        get: () => this.adapter.string().get(ref),
        set: (value) => this.adapter.string().set(ref, value),
      }),
      array: (schema, ref) => {
        const adapter = this.adapter.array()
        const bind = (elementRef: Ref) => this.bind(schema.element, elementRef)

        return {
          get length() {
            return adapter.getElementReferences(ref).length
          },
          at: (index) => bind(adapter.getElementReferences(ref)[index]),
          map: (fn) =>
            adapter
              .getElementReferences(ref)
              .map((elementRef, index) => fn(bind(elementRef), index)),
        }
      },
    }

    return schema.visit(visitor, reference)
  }

  save<S extends Schema>(schema: S, value: JSONValueOf<S>): Ref {
    const reference = this.saveInternal(schema, value)
    this.adapter.attach(reference)
    return reference
  }

  private saveInternal<S extends Schema>(schema: S, value: JSONValueOf<S>): Ref {
    const visitor: SchemaVisitor<JSONValueOf<S>, Ref> = {
      string: (_schema, value) => {
        if (typeof value !== "string") throw new TypeError("Expected string value")

        return this.adapter.string().create(value)
      },
      array: (schema, value) => {
        if (!Array.isArray(value)) throw new TypeError("Expected array value")

        const elementRefs = value.map((elementValue) =>
          this.saveInternal(schema.element, elementValue),
        )
        return this.adapter.array().create(elementRefs)
      },
    }

    return schema.visit(visitor, value)
  }

  load<S extends Schema>(schema: S, reference: Ref): JSONValueOf<S>
  load(schema: Schema, reference: Ref): unknown {
    const visitor: SchemaVisitor<Ref, unknown> = {
      string: (_schema, reference) => this.adapter.string().get(reference),
      array: (schema, reference) =>
        this.adapter
          .array()
          .getElementReferences(reference)
          .map((elementRef) => this.load(schema.element, elementRef)),
    }

    return schema.visit(visitor, reference)
  }
}

// FlatStorage

type FlatStorageRef = string & { __storageRef: true }

class FlatStorageAdapter implements StorageAdapter<FlatStorageRef, FlatStorageRef> {
  private storage = new Map<string, string | FlatStorageRef[]>()

  attach(_reference: FlatStorageRef): void {}

  string(): StringStorageAdapter<FlatStorageRef> {
    return {
      create: (value) => {
        const reference = `string:${Math.random().toString(36).slice(2)}`
        this.storage.set(reference, value)
        return reference as FlatStorageRef
      },
      get: (reference) => {
        const value = this.storage.get(reference)
        if (typeof value !== "string") throw new TypeError("Expected string value")
        return value
      },
      set: (reference, value) => this.storage.set(reference, value),
    }
  }

  array(): ArrayStorageAdapter<FlatStorageRef, FlatStorageRef> {
    return {
      create: (children) => {
        const reference = `array:${Math.random().toString(36).slice(2)}`
        this.storage.set(reference, children)
        return reference as FlatStorageRef
      },
      getElementReferences: (reference) => {
        const value = this.storage.get(reference)
        if (!Array.isArray(value)) throw new TypeError("Expected array value")
        return value
      },
    }
  }
}

// Yjs storage

type YjsStringRef = Y.Text & { __storageRef: true }
type YjsArrayRef = Y.Array<YjsStorageRef> & { __storageRef: true }
type YjsStorageRef = YjsStringRef | YjsArrayRef

class YjsAdapter implements StorageAdapter<YjsStringRef, YjsArrayRef> {
  readonly doc: Y.Doc

  constructor(doc = new Y.Doc()) {
    this.doc = doc
  }

  attach(reference: YjsStorageRef): void {
    this.doc.getMap("root").set("root", reference)
  }

  string(): StringStorageAdapter<YjsStringRef> {
    return {
      create: (value) => new Y.Text(value) as YjsStringRef,
      get: (reference) => reference.toString(),
      set: (reference, value) => {
        reference.delete(0, reference.length)
        reference.insert(0, value)
      },
    }
  }

  array(): ArrayStorageAdapter<YjsArrayRef, YjsStorageRef> {
    return {
      create: (children) => {
        const reference = new Y.Array<YjsStorageRef>()
        reference.push(children)
        return reference as YjsArrayRef
      },
      getElementReferences: (reference) => reference.toArray(),
    }
  }
}

// Example usage

export const tags = array(string())

function showTagExample<Ref extends StorageRef>(name: string, storage: Storage<Ref>): void {
  const ref = storage.save(tags, ["schema", "storage"])
  const values = storage.bind(tags, ref)

  values.at(0).set(`${name} schema`)
  console.log(
    `${name} tags:`,
    values.map((tag) => tag.get()),
  )
  console.log(`${name} JSON:`, storage.load(tags, ref))
}

const storage = new Storage(new FlatStorageAdapter())
showTagExample("FlatStorage", storage)

const yjsAdapter = new YjsAdapter()
const yjsStorage = new Storage(yjsAdapter)
showTagExample("Yjs", yjsStorage)
