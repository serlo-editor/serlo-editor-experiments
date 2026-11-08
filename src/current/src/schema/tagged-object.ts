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
  if (type.length === 0) throw new TypeError("Expected object type.")

  const contentSchema = object(fields)
  const storageSchema = object({ ...fields, type: string() })

  return {
    type,
    defaultValue: () => ({ type, ...contentSchema.defaultValue() }),

    create(store, snapshot) {
      // TODO: Find a way to avoid this cast.
      return storageSchema.create(store, snapshot as SnapshotOf<typeof storageSchema>)
    },
    bind(store, ref) {
      const content = contentSchema.bind(store, ref)
      // Capture before replacing snapshot, or the tagged method would recurse.
      const snapshot = content.snapshot
      return Object.assign(content, { type, snapshot: () => ({ type, ...snapshot() }) })
    },
  }
}
