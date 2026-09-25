import * as Y from "yjs"

import { FlatNodeStore } from "./flat-storage.ts"

// Values

type JSONValue = boolean | string | JSONValue[] | { [key: string]: JSONValue }
type ValueType = "boolean" | "string" | "array" | "object"

interface BaseValue<Serialized extends JSONValue, Kind extends ValueType> {
  readonly type: Kind
  get(): Serialized
}

interface BooleanValue extends BaseValue<boolean, "boolean"> {
  set(value: boolean): void
}

interface StringValue extends BaseValue<string, "string"> {
  set(value: string): void
}

interface ArrayValue<Item extends JSONValue> extends BaseValue<Item[], "array"> {
  map<R>(fn: (value: ValueOf<Item>, index: number) => R): R[]
}

interface ObjectValue<Shape extends Record<string, JSONValue>> extends BaseValue<Shape, "object"> {
  field<Key extends keyof Shape>(key: Key): ValueOf<Shape[Key]>
}

type ValueOf<Serialized extends JSONValue> = Serialized extends boolean
  ? BooleanValue
  : Serialized extends string
    ? StringValue
    : Serialized extends JSONValue[]
      ? ArrayValue<Serialized[number]>
      : Serialized extends Record<string, JSONValue>
        ? ObjectValue<Serialized>
        : never

interface JSONStorage {
  save<Serialized extends JSONValue>(value: Serialized): ValueOf<Serialized>
}

type NodeType = "boolean" | "string" | "array" | "object"
type NodeReference<Type extends NodeType = NodeType> = {
  type: Type
  id: string
}
type AnyNodeReference =
  | NodeReference<"boolean">
  | NodeReference<"string">
  | NodeReference<"array">
  | NodeReference<"object">
type AnyValue =
  | BooleanValue
  | StringValue
  | ArrayValue<JSONValue>
  | ObjectValue<Record<string, JSONValue>>

// Flat storage

export class FlatJSONStorage implements JSONStorage {
  readonly store = new FlatNodeStore()

  save<Serialized extends JSONValue>(value: Serialized): ValueOf<Serialized> {
    return bindFlatValue(this.store, createFlatValue(this.store, value)) as ValueOf<Serialized>
  }
}

function createFlatValue(store: FlatNodeStore, value: JSONValue): AnyNodeReference {
  if (typeof value === "boolean") return store.create("boolean", value)
  if (typeof value === "string") return store.create("string", value)
  if (Array.isArray(value)) {
    return store.create(
      "array",
      value.map((item) => createFlatValue(store, item)),
    )
  }

  const fields: Record<string, NodeReference | undefined> = {}
  for (const [key, item] of Object.entries(value)) {
    fields[key] = createFlatValue(store, item)
  }

  return store.create("object", fields)
}

function bindFlatValue(store: FlatNodeStore, reference: AnyNodeReference): AnyValue {
  switch (reference.type) {
    case "boolean":
      return {
        type: "boolean",
        get: () => store.get(reference),
        set: (value) => store.update(reference, value),
      }
    case "string":
      return {
        type: "string",
        get: () => store.get(reference),
        set: (value) => store.update(reference, value),
      }
    case "array":
      return {
        type: "array",
        get: () =>
          (store.get(reference) as AnyNodeReference[]).map((item) =>
            bindFlatValue(store, item).get(),
          ),
        map: (fn) =>
          (store.get(reference) as AnyNodeReference[]).map((item, index) =>
            fn(bindFlatValue(store, item), index),
          ),
      }
    case "object":
      return {
        type: "object",
        get: () => {
          const value: Record<string, JSONValue> = {}
          for (const [key, item] of Object.entries(
            store.get(reference) as Record<string, NodeReference | undefined>,
          )) {
            if (item !== undefined)
              value[key] = bindFlatValue(store, item as AnyNodeReference).get()
          }
          return value
        },
        field: (key) => {
          const item = (store.get(reference) as Record<string, NodeReference | undefined>)[
            String(key)
          ]
          if (item === undefined) throw new Error(`Cannot find field: ${String(key)}`)
          return bindFlatValue(store, item as AnyNodeReference)
        },
      }
  }
}

// Yjs storage

type YNode = Y.Map<unknown>

export class YjsJSONStorage implements JSONStorage {
  readonly doc: Y.Doc
  private readonly nodes: Y.Map<YNode>

  constructor(doc = new Y.Doc()) {
    this.doc = doc
    this.nodes = doc.getMap<YNode>("json-storage")
  }

  save<Serialized extends JSONValue>(value: Serialized): ValueOf<Serialized> {
    let reference!: NodeReference
    this.doc.transact(() => {
      reference = this.createNode(value)
    }, "json-storage")

    return bindYValue(this, reference) as ValueOf<Serialized>
  }

  private createNode(value: JSONValue): NodeReference {
    if (typeof value === "boolean") return this.createPrimitive("boolean", value)
    if (typeof value === "string") return this.createPrimitive("string", value)
    if (Array.isArray(value)) {
      const reference = this.newReference("array")
      const items = new Y.Array<string>()
      items.push(value.map((item) => this.createNode(item).id))

      const node = new Y.Map<unknown>()
      node.set("type", "array")
      node.set("items", items)
      this.nodes.set(reference.id, node)
      return reference
    }

    const reference = this.newReference("object")
    const fields = new Y.Map<string>()
    for (const [key, item] of Object.entries(value)) {
      fields.set(key, this.createNode(item).id)
    }

    const node = new Y.Map<unknown>()
    node.set("type", "object")
    node.set("fields", fields)
    this.nodes.set(reference.id, node)
    return reference
  }

  private createPrimitive(type: "boolean" | "string", value: boolean | string): NodeReference {
    const reference = this.newReference(type)
    const node = new Y.Map<unknown>()
    node.set("type", type)
    node.set("value", value)
    this.nodes.set(reference.id, node)
    return reference
  }

  private newReference(type: NodeType): NodeReference {
    let id: string
    do {
      id = `${type}-${Math.random().toString(36).slice(2)}`
    } while (this.nodes.has(id))

    return { type, id }
  }

  private node(reference: NodeReference): YNode {
    const node = this.nodes.get(reference.id)
    if (!node || node.get("type") !== reference.type) {
      throw new Error(`Cannot find node: ${reference.id}`)
    }
    return node
  }

  getBoolean(reference: NodeReference<"boolean">): boolean {
    const value = this.node(reference).get("value")
    if (typeof value !== "boolean") throw new TypeError("Invalid boolean value")
    return value
  }

  getString(reference: NodeReference<"string">): string {
    const value = this.node(reference).get("value")
    if (typeof value !== "string") throw new TypeError("Invalid string value")
    return value
  }

  setBoolean(reference: NodeReference<"boolean">, value: boolean): void {
    this.doc.transact(() => this.node(reference).set("value", value), "json-storage")
  }

  setString(reference: NodeReference<"string">, value: string): void {
    this.doc.transact(() => this.node(reference).set("value", value), "json-storage")
  }

  getArray(reference: NodeReference<"array">): AnyNodeReference[] {
    const value = this.node(reference).get("items")
    if (!(value instanceof Y.Array)) throw new TypeError("Invalid array value")

    return value.toArray().map((id) => this.reference(id))
  }

  getObject(reference: NodeReference<"object">): Record<string, AnyNodeReference> {
    const value = this.node(reference).get("fields")
    if (!(value instanceof Y.Map)) throw new TypeError("Invalid object value")

    const fields: Record<string, AnyNodeReference> = {}
    value.forEach((id, key) => {
      fields[key] = this.reference(id)
    })
    return fields
  }

  private reference(id: string): AnyNodeReference {
    return { type: this.nodeType(id), id } as AnyNodeReference
  }

  private nodeType(id: string): NodeType {
    const node = this.nodes.get(id)
    const type = node?.get("type")
    if (type !== "boolean" && type !== "string" && type !== "array" && type !== "object") {
      throw new Error(`Cannot find node: ${id}`)
    }
    return type
  }
}

function bindYValue(storage: YjsJSONStorage, reference: AnyNodeReference): AnyValue {
  switch (reference.type) {
    case "boolean":
      return {
        type: "boolean",
        get: () => storage.getBoolean(reference),
        set: (value) => storage.setBoolean(reference, value),
      }
    case "string":
      return {
        type: "string",
        get: () => storage.getString(reference),
        set: (value) => storage.setString(reference, value),
      }
    case "array":
      return {
        type: "array",
        get: () => storage.getArray(reference).map((item) => bindYValue(storage, item).get()),
        map: (fn) =>
          storage.getArray(reference).map((item, index) => fn(bindYValue(storage, item), index)),
      }
    case "object":
      return {
        type: "object",
        get: () => {
          const value: Record<string, JSONValue> = {}
          for (const [key, item] of Object.entries(storage.getObject(reference))) {
            value[key] = bindYValue(storage, item).get()
          }
          return value
        },
        field: (key) => {
          const item = storage.getObject(reference)[String(key)]
          if (item === undefined) throw new Error(`Cannot find field: ${String(key)}`)
          return bindYValue(storage, item)
        },
      }
  }
}
