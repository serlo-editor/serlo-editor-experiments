import * as Y from "yjs"

import { FlatNodeStore } from "./flat-storage.ts"
import type { NodeReference, AnyNodeReference } from "./flat-storage.ts"

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

type AnyValue =
  | BooleanValue
  | StringValue
  | ArrayValue<JSONValue>
  | ObjectValue<Record<string, JSONValue>>

// Storage

interface JSONStorage {
  save<Serialized extends JSONValue>(value: Serialized): ValueOf<Serialized>
}

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
        get() {
          return this.map((item) => item.get())
        },
        map(fn) {
          return store.get(reference).map((item, index) => fn(bindFlatValue(store, item), index))
        },
      }
    case "object":
      return {
        type: "object",
        get() {
          const value: Record<string, JSONValue> = {}
          for (const [key, item] of Object.entries(store.get(reference))) {
            if (item !== undefined) value[key] = this.field(key).get()
          }
          return value
        },
        field(key) {
          const item = store.get(reference)[String(key)]
          if (item === undefined) throw new Error(`Cannot find field: ${String(key)}`)
          return bindFlatValue(store, item)
        },
      }
  }
}

// YJS implementation

type YStoredValue = boolean | string | Y.Array<YStoredValue> | Y.Map<YStoredValue>

export class YjsJSONStorage implements JSONStorage {
  private readonly doc: Y.Doc
  private readonly contentMap: Y.Map<YStoredValue>

  constructor(doc = new Y.Doc()) {
    this.doc = doc
    this.contentMap = this.doc.getMap("content")
  }

  save<Serialized extends JSONValue>(value: Serialized): ValueOf<Serialized> {
    const storedValue = createYValue(value)
    this.contentMap.set("content", storedValue)

    return bindYValue(storedValue, (newValue) =>
      this.contentMap.set("content", newValue),
    ) as ValueOf<Serialized>
  }
}

function createYValue(value: JSONValue): YStoredValue {
  if (typeof value === "boolean" || typeof value === "string") return value

  if (Array.isArray(value)) {
    const array = new Y.Array<YStoredValue>()
    array.push(value.map(createYValue))
    return array
  }

  const object = new Y.Map<YStoredValue>()
  for (const [key, item] of Object.entries(value)) object.set(key, createYValue(item))
  return object
}

function bindYValue(value: YStoredValue, update: (newValue: YStoredValue) => void): AnyValue {
  if (typeof value === "boolean") {
    return {
      type: "boolean",
      get: () => value,
      set: (nextValue) => update(nextValue),
    }
  }

  if (typeof value === "string") {
    return {
      type: "string",
      get: () => value,
      set: (nextValue) => update(nextValue),
    }
  }

  if (value instanceof Y.Array) {
    return {
      type: "array",
      get() {
        return this.map((item) => item.get())
      },
      map(fn) {
        return value.toArray().map((_, index) => {
          const item = bindYValue(value, (newValue) => {
            value.delete(index)
            value.insert(index, [newValue])
          })

          return fn(item, index)
        })
      },
    }
  }

  return {
    type: "object",
    get() {
      const result: Record<string, JSONValue> = {}
      for (const key of value.keys()) result[key] = this.field(key).get()
      return result
    },
    field(key) {
      const item = value.get(key)
      if (item === undefined) throw new Error(`Cannot find field: ${String(key)}`)

      return bindYValue(item, (newValue) => value.set(key, newValue))
    },
  }
}
