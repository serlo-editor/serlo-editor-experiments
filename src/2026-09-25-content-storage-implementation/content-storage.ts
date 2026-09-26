import type { Editor, NodeJSON } from "prosekit/core"
import * as Y from "yjs"

import { FlatNodeStore, type NodeReference } from "./flat-storage.ts"
import { LocalRichTextStore, YjsRichTextStore } from "./rich-text-storage.ts"
import {
  validateSnapshot,
  type ArraySchema,
  type BooleanSchema,
  type ObjectSchema,
  type RichTextSchema,
  type Schema,
  type SnapshotOf,
  type StringSchema,
} from "./schema.ts"

export type { Schema, SnapshotOf } from "./schema.ts"

export interface ContentStorage {
  save<S extends Schema>(schema: S, snapshot: SnapshotOf<S>): ValueOf<S>
  dispose(): void
}

export interface BooleanValue {
  readonly type: "boolean"
  get(): boolean
  set(value: boolean): void
}

export interface StringValue {
  readonly type: "string"
  get(): string
  set(value: string): void
}

export interface ArrayValue<Item extends Schema> {
  readonly type: "array"
  get(): SnapshotOf<Item>[]
  map<R>(fn: (value: ValueOf<Item>, index: number) => R): R[]
}

export interface ObjectValue<Fields extends Record<string, Schema>> {
  readonly type: "object"
  get(): { [Key in keyof Fields]: SnapshotOf<Fields[Key]> }
  field<Key extends keyof Fields>(key: Key): ValueOf<Fields[Key]>
}

export interface RichTextValue {
  readonly type: "richText"
  get(): NodeJSON
  editor(): Editor
}

export type ValueOf<S extends Schema> = S extends BooleanSchema
  ? BooleanValue
  : S extends StringSchema
    ? StringValue
    : S extends RichTextSchema
      ? RichTextValue
      : S extends ArraySchema<infer Item>
        ? ArrayValue<Item>
        : S extends ObjectSchema<infer Fields>
          ? ObjectValue<Fields>
          : never

type AnyValue = ValueOf<Schema>

// Local storage: flat nodes hold structure; editors own rich-text state.

export class LocalContentStorage implements ContentStorage {
  private readonly nodes = new FlatNodeStore()
  private readonly richText = new LocalRichTextStore()
  private disposed = false

  save<S extends Schema>(schema: S, snapshot: SnapshotOf<S>): ValueOf<S> {
    this.assertActive()
    validateSnapshot(schema, snapshot)
    return this.bind(schema, this.create(schema, snapshot)) as ValueOf<S>
  }

  dispose(): void {
    this.richText.dispose()
    this.nodes.clear()
    this.disposed = true
  }

  private create(schema: Schema, snapshot: unknown): NodeReference {
    switch (schema.kind) {
      case "boolean":
        return this.nodes.create("boolean", snapshot as boolean)
      case "string":
        return this.nodes.create("string", snapshot as string)
      case "array":
        return this.nodes.create(
          "array",
          (snapshot as unknown[]).map((item) => this.create(schema.item, item)),
        )
      case "object":
        return this.nodes.create(
          "object",
          Object.fromEntries(
            Object.entries(schema.fields).map(([key, field]) => [
              key,
              this.create(field, (snapshot as Record<string, unknown>)[key]),
            ]),
          ),
        )
      case "richText": {
        const reference = this.nodes.create("richText", null)
        this.richText.create(reference.id, schema, snapshot as NodeJSON)
        return reference
      }
    }
  }

  private bind(schema: Schema, reference: NodeReference): AnyValue {
    const read = <Type extends NodeReference["type"]>(type: Type) => {
      this.assertActive()
      if (reference.type !== type) throw new Error(`Expected ${type}`)
      return this.nodes.get({ type, id: reference.id })
    }

    switch (schema.kind) {
      case "boolean":
        return {
          type: "boolean",
          get: () => read("boolean"),
          set: (value) => {
            this.assertActive()
            this.nodes.update({ type: "boolean", id: reference.id }, value)
          },
        }
      case "string":
        return {
          type: "string",
          get: () => read("string"),
          set: (value) => {
            this.assertActive()
            this.nodes.update({ type: "string", id: reference.id }, value)
          },
        }
      case "array":
        return {
          type: "array",
          get() {
            return this.map((item) => item.get())
          },
          map: (fn) => read("array").map((item, index) => fn(this.bind(schema.item, item), index)),
        }
      case "object":
        return {
          type: "object",
          get() {
            return Object.fromEntries(
              Object.keys(schema.fields).map((key) => [key, this.field(key).get()]),
            )
          },
          field: (key) => {
            const field = getField(schema, key)
            const item = read("object")[key]
            if (!item) throw new Error(`Cannot find field: ${key}`)
            return this.bind(field, item)
          },
        }
      case "richText": {
        const value = this.richText.bind(reference.id, schema)
        return {
          type: "richText",
          get: () => {
            read("richText")
            return value.get()
          },
          editor: () => {
            read("richText")
            return value.editor()
          },
        }
      }
    }
  }

  private assertActive(): void {
    if (this.disposed) throw new Error("Content storage is disposed")
  }
}

// Yjs storage: nested shared types, with inline XML fragments for rich text.

type YStoredValue = boolean | string | Y.Array<YStoredValue> | Y.Map<YStoredValue> | Y.XmlFragment

export class YjsContentStorage implements ContentStorage {
  readonly doc: Y.Doc
  private readonly ownsDoc: boolean
  private readonly roots: Y.Map<YStoredValue>
  private readonly richText = new YjsRichTextStore()
  private disposed = false

  constructor(doc?: Y.Doc) {
    this.doc = doc ?? new Y.Doc()
    this.ownsDoc = doc === undefined
    this.roots = this.doc.getMap("content")
  }

  save<S extends Schema>(schema: S, snapshot: SnapshotOf<S>): ValueOf<S> {
    this.assertActive()
    validateSnapshot(schema, snapshot)
    const id = crypto.randomUUID()
    this.doc.transact(() => {
      const initialize: (() => void)[] = []
      this.roots.set(id, this.create(schema, snapshot, initialize))
      // y-prosemirror reads fragments during import; integrate the tree first.
      for (const seed of initialize) seed()
    })
    return this.bind(
      schema,
      () => this.roots.get(id),
      (value) => this.roots.set(id, value),
    ) as ValueOf<S>
  }

  dispose(): void {
    if (this.disposed) return
    this.richText.dispose()
    if (this.ownsDoc) this.doc.destroy()
    this.disposed = true
  }

  private create(schema: Schema, snapshot: unknown, initialize: (() => void)[]): YStoredValue {
    switch (schema.kind) {
      case "boolean":
      case "string":
        return snapshot as boolean | string
      case "array": {
        const array = new Y.Array<YStoredValue>()
        array.push(
          (snapshot as unknown[]).map((item) => this.create(schema.item, item, initialize)),
        )
        return array
      }
      case "object": {
        const object = new Y.Map<YStoredValue>()
        for (const [key, field] of Object.entries(schema.fields)) {
          object.set(
            key,
            this.create(field, (snapshot as Record<string, unknown>)[key], initialize),
          )
        }
        return object
      }
      case "richText": {
        const fragment = new Y.XmlFragment()
        initialize.push(() => this.richText.initialize(fragment, schema, snapshot as NodeJSON))
        return fragment
      }
    }
  }

  private bind(
    schema: Schema,
    read: () => YStoredValue | undefined,
    update: (value: YStoredValue) => void,
  ): AnyValue {
    const current = () => {
      this.assertActive()
      const value = read()
      if (value === undefined) throw new Error("Cannot find content value")
      return value
    }
    const set = (value: boolean | string) => {
      this.assertActive()
      update(value)
    }

    switch (schema.kind) {
      case "boolean":
        return { type: "boolean", get: () => current() as boolean, set }
      case "string":
        return { type: "string", get: () => current() as string, set }
      case "array":
        return {
          type: "array",
          get() {
            return this.map((item) => item.get())
          },
          map: (fn) => {
            const array = current() as Y.Array<YStoredValue>
            return array.toArray().map((_, index) =>
              fn(
                this.bind(
                  schema.item,
                  () => array.get(index),
                  (value) =>
                    this.doc.transact(() => {
                      array.delete(index, 1)
                      array.insert(index, [value])
                    }),
                ),
                index,
              ),
            )
          },
        }
      case "object":
        return {
          type: "object",
          get() {
            return Object.fromEntries(
              Object.keys(schema.fields).map((key) => [key, this.field(key).get()]),
            )
          },
          field: (key) => {
            const field = getField(schema, key)
            const object = current() as Y.Map<YStoredValue>
            return this.bind(
              field,
              () => object.get(key),
              (value) => object.set(key, value),
            )
          },
        }
      case "richText":
        return {
          type: "richText",
          get: () => this.richText.bind(current() as Y.XmlFragment, schema).get(),
          editor: () => this.richText.bind(current() as Y.XmlFragment, schema).editor(),
        }
    }
  }

  private assertActive(): void {
    if (this.disposed) throw new Error("Content storage is disposed")
  }
}

function getField(schema: ObjectSchema, key: string): Schema {
  const field = Object.hasOwn(schema.fields, key) ? schema.fields[key] : undefined
  if (!field) throw new Error(`Unknown field: ${key}`)
  return field
}
