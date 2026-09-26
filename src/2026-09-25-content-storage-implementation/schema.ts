import { createEditor, type Extension, type NodeJSON } from "prosekit/core"
import type { Schema as ProseMirrorSchema } from "prosemirror-model"

export type Schema = BooleanSchema | StringSchema | ArraySchema | ObjectSchema | RichTextSchema

export interface BooleanSchema {
  readonly kind: "boolean"
}

export interface StringSchema {
  readonly kind: "string"
}

export interface ArraySchema<Item extends Schema = Schema> {
  readonly kind: "array"
  readonly item: Item
}

export interface ObjectSchema<Fields extends Record<string, Schema> = Record<string, Schema>> {
  readonly kind: "object"
  readonly fields: Fields
}

export interface RichTextSchema {
  readonly kind: "richText"
  readonly extension: Extension
  readonly prosemirror: ProseMirrorSchema
}

export type SnapshotOf<S extends Schema> = S extends BooleanSchema
  ? boolean
  : S extends StringSchema
    ? string
    : S extends RichTextSchema
      ? NodeJSON
      : S extends ArraySchema<infer Item>
        ? SnapshotOf<Item>[]
        : S extends ObjectSchema<infer Fields>
          ? { [Key in keyof Fields]: SnapshotOf<Fields[Key]> }
          : never

// Extensions describe document nodes, marks and commands, not backend-specific plugins.
export function richText(extension: Extension): RichTextSchema {
  return { kind: "richText", extension, prosemirror: createEditor({ extension }).schema }
}

// Validate before writing: Yjs transactions batch updates but do not roll back errors.
export function validateSnapshot(schema: Schema, value: unknown): void {
  switch (schema.kind) {
    case "boolean":
    case "string":
      if (typeof value !== schema.kind) throw new Error(`Expected ${schema.kind}`)
      return
    case "array":
      if (!Array.isArray(value)) throw new Error("Expected array")
      for (const item of value) validateSnapshot(schema.item, item)
      return
    case "object": {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error("Expected object")
      }
      const fields = value as Record<string, unknown>
      for (const key of Object.keys(fields)) {
        if (!Object.hasOwn(schema.fields, key)) throw new Error(`Unknown field: ${key}`)
      }
      for (const [key, field] of Object.entries(schema.fields)) {
        if (!Object.hasOwn(fields, key)) throw new Error(`Missing field: ${key}`)
        validateSnapshot(field, fields[key])
      }
      return
    }
    case "richText": {
      const node = schema.prosemirror.nodeFromJSON(value)
      if (node.type !== schema.prosemirror.topNodeType)
        throw new Error("Expected rich-text document")
      node.check()
    }
  }
}
