import { isObject } from "../utils/guard.ts"
import { object, type ObjectSnapshot, type ObjectFields, type StoredObject } from "./object.ts"
import { string } from "./primitives.ts"
import type { Schema, SnapshotOf } from "./types.ts"

export type TaggedFields = ObjectFields & { type?: never }

export type TaggedSnapshot<Type extends string, Fields extends TaggedFields> = {
  readonly type: Type
} & ObjectSnapshot<Fields>

// TODO: Can this type be simplified?
export type StoredTaggedObject<
  Type extends string = string,
  Fields extends TaggedFields = {},
> = Omit<StoredObject<Fields>, "snapshot"> & {
  readonly type: Type
  snapshot(): TaggedSnapshot<Type, Fields>
}

export interface TaggedObjectDefinition<
  Type extends string = string,
  Fields extends TaggedFields = TaggedFields,
> extends Schema<TaggedSnapshot<Type, Fields>, StoredTaggedObject<Type, Fields>, "map"> {
  readonly type: Type
  readonly fields: Fields
}

export function isTaggedObject<Type extends string, Fields extends TaggedFields>(
  definition: TaggedObjectDefinition<Type, Fields>,
  value: StoredTaggedObject,
): value is StoredTaggedObject<Type, Fields> {
  return isObject(value) && value.type === definition.type
}

export function taggedObject<const Type extends string, Fields extends TaggedFields>({
  type,
  fields,
}: {
  type: Type
  fields: Fields
}): TaggedObjectDefinition<Type, Fields> {
  if (typeof type !== "string" || !type) throw new TypeError("Expected object type.")
  for (const key of ["type", "definition"]) {
    if (Object.hasOwn(fields, key)) throw new TypeError(`Reserved object field: ${key}.`)
  }

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
      const snapshot = content.snapshot
      return Object.assign(content, {
        type,
        definition,
        snapshot: () => ({ type, ...snapshot() }),
      })
    },
  }
  return definition
}
