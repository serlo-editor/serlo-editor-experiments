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

type StorageRef = unknown & {__storageRef: true}

interface StringStorageAdapter<Ref extends StorageRef> {
  get(reference: Ref): string
  set(refernece: Ref, value: string): void
}

interface ArrayStorageAdapter<Ref extends StorageRef, ElementRef extends StorageRef> {
  getLength(reference: Ref): number
  getElement(reference: Ref, index: number): ElementRef
  map<R>(reference: Ref, fn: (elementRef: ElementRef, index: number) => R): R[]
}

interface StorageAdapter<StringRef extends StorageRef, ArrayRef extends StorageRef> {
  string: StringStorageAdapter<StringRef>
  array: ArrayStorageAdapter<ArrayRef, StringRef | ArrayRef>
}

class StringValueImpl implements StringValue {
  constructor(private reference: StorageRef, private adapter: StringStorageAdapter<StorageRef>) {}

  get(): string {
    return this.adapter.get(this.reference)
  }

  set(value: string): void {
    this.adapter.set(this.reference, value)
  }
}

class ArrayValueImpl<T extends Value> implements ArrayValue<T> {
  constructor(
    private reference: StorageRef,
    private adapter: ArrayStorageAdapter<StorageRef, StorageRef>,
    private elementFactory: (elementRef: StorageRef) => T,
  ) {}

  get length(): number {
    return this.adapter.getLength(this.reference)
  }

  at(index: number): T {
    const elementRef = this.adapter.getElement(this.reference, index)
    return this.elementFactory(elementRef)
  }

  map<R>(fn: (value: T, index: number) => R): R[] {
    return this.adapter.map(this.reference, (elementRef, index) => {
      const element = this.elementFactory(elementRef)
      return fn(element, index)
    })
  }
}

class Storage {
  __constructor(private adapter: StorageAdapter<StorageRef, StorageRef>) {}

  save<S extends Schema>(schema: S, value: JSONValueOf<S>): StorageRef {
    return schema.visit(
      {
        string: (schema, value) => {
          const ref = {} as StorageRef
          this.adapter.string.set(ref, value)
          return ref
        },
        array: (schema, value) => {
          const ref = {} as StorageRef
          for (const element of value) {
            const elementRef = this.save(schema.element, element)
            this.adapter.array.getElement(ref, this.adapter.array.getLength(ref)).set(elementRef)
          }
          return ref
        },
      },
      value,
    )
  }

  load<S extends Schema>(schema: S, reference: StorageRef): JSONValueOf<S> {
    return schema.visit(
      {
        string: (schema, reference) => {
          return this.adapter.string.get(reference)
        }



      }}




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
