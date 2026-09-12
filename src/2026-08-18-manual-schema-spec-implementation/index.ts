// Value types

export interface StringValue {
  get(): string
  set(value: string): void
}

export interface ArrayValue<T> {
  readonly length: number
  at(index: number): T
  map<R>(fn: (value: T, index: number) => R): R[]
  insert(index: number, value: unknown): void
  remove(index: number): void
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

export const string = (): StringSchema => ({ kind: "string" })

export interface ArraySchema<C extends Schema> extends Schema<
  ArrayValue<ValueOf<C>>,
  JSONValueOf<C>[]
> {
  readonly kind: "array"
  readonly element: C
}

export const array = <C extends Schema>(element: C): ArraySchema<C> => ({
  kind: "array",
  element,
})

// Store adapter

declare const refBrand: unique symbol
export type Ref = string & { readonly [refBrand]: true }

export interface StoreAdapter {
  string: {
    get(ref: Ref): string
    set(ref: Ref, value: string): void
    create(value: string): Ref
  }
  array: {
    getLength(ref: Ref): number
    getItem(ref: Ref, index: number): Ref
    insertItem(ref: Ref, index: number, child: Ref): void
    removeItem(ref: Ref, index: number): void
    create(items: Ref[]): Ref
  }
}

// Value binding and creation

export function bind<S extends Schema>(schema: S, store: StoreAdapter, ref: Ref): ValueOf<S>
export function bind(schema: Schema, store: StoreAdapter, ref: Ref): Value {
  if (schema.kind === "string") {
    return {
      get: () => store.string.get(ref),
      set: (value: string) => store.string.set(ref, value),
    }
  }

  if (schema.kind === "array") {
    const arraySchema = schema as ArraySchema<Schema>

    return {
      get length() {
        return store.array.getLength(ref)
      },
      at(index: number) {
        return bind(arraySchema.element, store, store.array.getItem(ref, index))
      },
      map<R>(fn: (value: Value, index: number) => R) {
        const result: R[] = []
        const length = store.array.getLength(ref)

        for (let index = 0; index < length; index += 1) {
          result.push(fn(this.at(index), index))
        }

        return result
      },
      insert(index: number, value: unknown) {
        const child = create(arraySchema.element, store, value)
        store.array.insertItem(ref, index, child)
      },
      remove(index: number) {
        store.array.removeItem(ref, index)
      },
    } satisfies ArrayValue<Value>
  }

  throw new Error(`Unsupported schema: ${schema.kind}`)
}

export function create<S extends Schema>(schema: S, store: StoreAdapter, json: JSONValueOf<S>): Ref
export function create(schema: Schema, store: StoreAdapter, json: unknown): Ref {
  if (schema.kind === "string") {
    if (typeof json !== "string") {
      throw new TypeError("Expected string value")
    }

    return store.string.create(json)
  }

  if (schema.kind === "array") {
    if (!Array.isArray(json)) {
      throw new TypeError("Expected array value")
    }

    const arraySchema = schema as ArraySchema<Schema>
    const children = json.map((value) => create(arraySchema.element, store, value))

    return store.array.create(children)
  }

  throw new Error(`Unsupported schema: ${schema.kind}`)
}

function checkIndex(index: number, length: number, allowEnd = false): void {
  if (!Number.isInteger(index) || index < 0 || index > length || (!allowEnd && index === length)) {
    throw new RangeError("Array index out of bounds")
  }
}

// Flat store

type FlatNode =
  | { readonly kind: "string"; value: string }
  | { readonly kind: "array"; items: Ref[] }

export class FlatStore implements StoreAdapter {
  private readonly nodes = new Map<Ref, FlatNode>()

  readonly string: StoreAdapter["string"] = {
    get: (ref) => this.getString(ref),
    set: (ref, value) => this.setString(ref, value),
    create: (value) => this.createString(value),
  }

  readonly array: StoreAdapter["array"] = {
    getLength: (ref) => this.getArrayLength(ref),
    getItem: (ref, index) => this.getArrayItem(ref, index),
    insertItem: (ref, index, child) => this.insertArrayItem(ref, index, child),
    removeItem: (ref, index) => this.removeArrayItem(ref, index),
    create: (items) => this.createArray(items),
  }

  createString(value: string): Ref {
    const ref = `flat-${this.nodes.size}` as Ref
    this.nodes.set(ref, { kind: "string", value })
    return ref
  }

  createArray(items: Ref[]): Ref {
    for (const item of items) this.node(item)

    const ref = `flat-${this.nodes.size}` as Ref
    this.nodes.set(ref, { kind: "array", items: [...items] })
    return ref
  }

  getString(ref: Ref): string {
    const node = this.node(ref)
    if (node.kind !== "string") throw new TypeError("Reference is not string")
    return node.value
  }

  setString(ref: Ref, value: string): void {
    const node = this.node(ref)
    if (node.kind !== "string") throw new TypeError("Reference is not string")
    node.value = value
  }

  getArrayLength(ref: Ref): number {
    return this.arrayNode(ref).items.length
  }

  getArrayItem(ref: Ref, index: number): Ref {
    const items = this.arrayNode(ref).items
    checkIndex(index, items.length)
    return items[index]!
  }

  insertArrayItem(ref: Ref, index: number, child: Ref): void {
    const items = this.arrayNode(ref).items
    checkIndex(index, items.length, true)
    this.node(child)
    items.splice(index, 0, child)
  }

  removeArrayItem(ref: Ref, index: number): void {
    const items = this.arrayNode(ref).items
    checkIndex(index, items.length)
    items.splice(index, 1)
  }

  private node(ref: Ref): FlatNode {
    const node = this.nodes.get(ref)
    if (!node) throw new Error("Unknown reference")
    return node
  }

  private arrayNode(ref: Ref): Extract<FlatNode, { kind: "array" }> {
    const node = this.node(ref)
    if (node.kind !== "array") throw new TypeError("Reference is not array")
    return node
  }
}

// Yjs store

import * as Y from "yjs"

type YNode = Y.Map<unknown> | Y.Array<Ref>

export class YjsStore implements StoreAdapter {
  readonly doc: Y.Doc
  private readonly nodes: Y.Map<YNode>

  readonly string: StoreAdapter["string"] = {
    get: (ref) => this.getString(ref),
    set: (ref, value) => this.setString(ref, value),
    create: (value) => this.createString(value),
  }

  readonly array: StoreAdapter["array"] = {
    getLength: (ref) => this.getArrayLength(ref),
    getItem: (ref, index) => this.getArrayItem(ref, index),
    insertItem: (ref, index, child) => this.insertArrayItem(ref, index, child),
    removeItem: (ref, index) => this.removeArrayItem(ref, index),
    create: (items) => this.createArray(items),
  }

  constructor(doc = new Y.Doc()) {
    this.doc = doc
    this.nodes = doc.getMap<YNode>("manual-schema-store")
  }

  createString(value: string): Ref {
    const node = new Y.Map<unknown>()
    node.set("kind", "string")
    node.set("value", value)
    return this.save(node)
  }

  createArray(items: Ref[]): Ref {
    const node = new Y.Array<Ref>()
    node.insert(0, [...items])
    return this.save(node)
  }

  getString(ref: Ref): string {
    const node = this.stringNode(ref)
    const value = node.get("value")
    if (typeof value !== "string") throw new TypeError("Invalid string value")
    return value
  }

  setString(ref: Ref, value: string): void {
    this.stringNode(ref).set("value", value)
  }

  getArrayLength(ref: Ref): number {
    return this.arrayNode(ref).length
  }

  getArrayItem(ref: Ref, index: number): Ref {
    const node = this.arrayNode(ref)
    checkIndex(index, node.length)
    return node.get(index)
  }

  insertArrayItem(ref: Ref, index: number, child: Ref): void {
    const node = this.arrayNode(ref)
    checkIndex(index, node.length, true)
    this.node(child)
    node.insert(index, [child])
  }

  removeArrayItem(ref: Ref, index: number): void {
    const node = this.arrayNode(ref)
    checkIndex(index, node.length)
    node.delete(index, 1)
  }

  private save(node: YNode): Ref {
    const ref = crypto.randomUUID() as Ref
    this.nodes.set(ref, node)
    return ref
  }

  private node(ref: Ref): YNode {
    if (typeof ref !== "string") throw new Error("Unknown reference")
    const node = this.nodes.get(ref)
    if (!node) throw new Error("Unknown reference")
    return node
  }

  private stringNode(ref: Ref): Y.Map<unknown> {
    const node = this.node(ref)
    if (!(node instanceof Y.Map) || node.get("kind") !== "string") {
      throw new TypeError("Reference is not string")
    }
    return node
  }

  private arrayNode(ref: Ref): Y.Array<Ref> {
    const node = this.node(ref)
    if (!(node instanceof Y.Array)) throw new TypeError("Reference is not array")
    return node
  }
}

export const tags = array(string())
