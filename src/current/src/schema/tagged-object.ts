import { isObject } from "../utils/guard.ts"
import { object, type ObjectSnapshot, type SchemaMap, type StoredObject } from "./object.ts"
import { string } from "./primitives.ts"
import type { Schema, SnapshotOf } from "./types.ts"

export type TaggedSnapshot<Type extends string, Fields extends SchemaMap> = {
  readonly type: Type
} & ObjectSnapshot<Fields>

export interface StoredTaggedObject<
  Type extends string,
  Fields extends SchemaMap,
> extends StoredObject<Fields> {
  readonly type: Type
  readonly definition: TaggedObjectDefinition<Type, Fields>
  snapshot(): TaggedSnapshot<Type, Fields>
}

export interface TaggedObjectDefinition<
  Type extends string,
  Fields extends SchemaMap,
> extends Schema<TaggedSnapshot<Type, Fields>, StoredTaggedObject<Type, Fields>, "map"> {
  readonly type: Type
  readonly fields: Fields
}

/** Object with a fixed, persisted discriminator and no rendering metadata. */
export function taggedObject<const Type extends string, Fields extends SchemaMap>({
  type,
  fields,
}: {
  type: Type
  fields: Fields & { type?: never }
}): TaggedObjectDefinition<Type, Fields> {
  if (typeof type !== "string" || !type) throw new TypeError("Expected object type.")
  if (Object.hasOwn(fields, "type")) throw new TypeError("Reserved object field: type.")

  const contentSchema = object<Fields>(fields)
  const storageSchema = object({ ...fields, type: string() })
  const definition: TaggedObjectDefinition<Type, Fields> = {
    type,
    fields,
    create(store, snapshot) {
      if (!isObject(snapshot) || !Object.hasOwn(snapshot, "type") || snapshot.type !== type)
        throw new TypeError(`Expected object type: ${type}.`)
      for (const key of Object.keys(snapshot)) {
        if (key !== "type" && !Object.hasOwn(fields, key))
          throw new TypeError(`Unknown field: ${key}.`)
      }
      return storageSchema.create(store, snapshot as SnapshotOf<typeof storageSchema>)
    },
    bind(store, ref) {
      const storedType = store.map.getField(ref, "type")
      if (storedType === undefined || store.cell.get(storedType) !== type)
        throw new TypeError(`Expected object type: ${type}.`)
      const content = contentSchema.bind(store, ref)
      return {
        ...content,
        type,
        definition,
        snapshot: () => ({ type, ...content.snapshot() }),
      }
    },
  }
  return definition
}
