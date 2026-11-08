import type { ReactNode } from "react"

import { isObject } from "../utils/guard.ts"
import { object, type ObjectSnapshot, type StoredObject } from "./object.ts"
import { string } from "./primitives.ts"
import { taggedObject, type TaggedFields } from "./tagged-object.ts"
import type { Schema } from "./types.ts"

export type BlockFields = TaggedFields & { id?: never }

export type BlockSnapshot<Type extends string, Fields extends BlockFields> = {
  readonly id: string
  readonly type: Type
} & ObjectSnapshot<Fields>

export type StoredBlock<Type extends string, Fields extends BlockFields> = Omit<
  StoredObject<Fields>,
  "snapshot"
> & {
  readonly id: string
  readonly type: Type
  readonly definition: BlockDefinition<Type, Fields>
  snapshot(): BlockSnapshot<Type, Fields>
}

export interface BlockDefinition<Type extends string, Fields extends BlockFields> extends Schema<
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
export function block<const Type extends string, Fields extends BlockFields>({
  type,
  fields,
  render,
}: {
  type: Type
  fields: Fields
  render: BlockDefinition<Type, Fields>["render"]
}): BlockDefinition<Type, Fields> {
  if (typeof type !== "string" || type.length === 0) throw new TypeError("Expected block type.")
  for (const key of ["id", "type", "definition"]) {
    if (Object.hasOwn(fields, key)) throw new TypeError(`Reserved block field: ${key}.`)
  }

  const contentSchema = object<Fields>(fields)
  const storageSchema = taggedObject<Type, Fields>({ type, fields: { ...fields, id: string() } })
  const definition: BlockDefinition<Type, Fields> = {
    type,
    fields,
    render,

    defaultValue() {
      return definition.createSnapshot(contentSchema.defaultValue())
    },

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
      return storageSchema.create(store, snapshot)
    },

    bind(store, ref) {
      const idRef = store.map.getField(ref, "id")
      const id = idRef === undefined ? undefined : store.cell.get(idRef)
      if (typeof id !== "string" || !id) throw new TypeError("Expected block ID.")
      const tagged = storageSchema.bind(store, ref)
      const content = contentSchema.bind(store, ref)
      const snapshot = content.snapshot
      return Object.assign(content, {
        id,
        type: tagged.type,
        definition,
        snapshot: () => ({ id, type: tagged.type, ...snapshot() }),
      })
    },
  }
  return definition
}
