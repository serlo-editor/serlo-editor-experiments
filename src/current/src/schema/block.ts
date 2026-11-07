import type { ReactNode } from "react"

import { isObject } from "../utils/guard.ts"
import { object, type ObjectSnapshot, type SchemaMap, type StoredObject } from "./object.ts"
import { string } from "./primitives.ts"
import type { Schema, SnapshotOf } from "./types.ts"

export type BlockSnapshot<Type extends string, Fields extends SchemaMap> = {
  readonly id: string
  readonly type: Type
} & ObjectSnapshot<Fields>

export interface StoredBlock<
  Type extends string,
  Fields extends SchemaMap,
> extends StoredObject<Fields> {
  readonly id: string
  readonly type: Type
  readonly definition: BlockDefinition<Type, Fields>
  snapshot(): BlockSnapshot<Type, Fields>
}

export interface BlockDefinition<Type extends string, Fields extends SchemaMap> extends Schema<
  BlockSnapshot<Type, Fields>,
  StoredBlock<Type, Fields>,
  "map"
> {
  readonly type: Type
  readonly fields: Fields
  /** Builds a detached snapshot with fresh identity; create(store, snapshot) preserves IDs. */
  createSnapshot(fields: ObjectSnapshot<Fields>): BlockSnapshot<Type, Fields>
  render(props: { value: StoredBlock<Type, Fields> }): ReactNode
}

/** Object schema with immutable identity, discriminator, and local renderer metadata. */
export function block<const Type extends string, Fields extends SchemaMap>({
  type,
  fields,
  render,
}: {
  type: Type
  fields: Fields & { readonly id?: never; readonly type?: never }
  render: BlockDefinition<Type, Fields>["render"]
}): BlockDefinition<Type, Fields> {
  if (typeof type !== "string" || type.length === 0) throw new TypeError("Expected block type.")
  for (const key of ["id", "type"]) {
    if (Object.hasOwn(fields, key)) throw new TypeError(`Reserved block field: ${key}.`)
  }

  const contentSchema = object<Fields>(fields)
  const storageSchema = object({ ...fields, id: string(), type: string() })
  const definition: BlockDefinition<Type, Fields> = {
    type,
    fields,
    render,

    createSnapshot(content) {
      return { ...structuredClone(content), id: crypto.randomUUID(), type }
    },

    create(store, snapshot) {
      if (!isObject(snapshot)) throw new TypeError("Expected block snapshot.")
      if (!Object.hasOwn(snapshot, "id") || typeof snapshot.id !== "string" || !snapshot.id) {
        throw new TypeError("Expected block ID.")
      }
      if (!Object.hasOwn(snapshot, "type") || snapshot.type !== type) {
        throw new TypeError(`Expected block type: ${type}.`)
      }
      for (const key of Object.keys(snapshot)) {
        if (key !== "id" && key !== "type" && !Object.hasOwn(fields, key)) {
          throw new TypeError(`Unknown field: ${key}.`)
        }
      }
      // Storage adds checked metadata to the same fields; TS cannot reduce generic mapped types.
      return storageSchema.create(store, snapshot as SnapshotOf<typeof storageSchema>)
    },

    bind(store, ref) {
      const idRef = store.map.getField(ref, "id")
      const typeRef = store.map.getField(ref, "type")
      const id = idRef === undefined ? undefined : store.cell.get(idRef)
      const storedType = typeRef === undefined ? undefined : store.cell.get(typeRef)
      if (typeof id !== "string" || !id) throw new TypeError("Expected block ID.")
      if (storedType !== type) throw new TypeError(`Expected block type: ${type}.`)
      const content = contentSchema.bind(store, ref)
      return {
        ...content,
        id,
        type,
        definition,
        snapshot: () => ({ id, type, ...content.snapshot() }),
      }
    },
  }
  return definition
}
