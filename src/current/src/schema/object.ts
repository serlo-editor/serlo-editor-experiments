import type { AnySchema, Schema, SnapshotOf, StoredValue, StoredValueOf } from "./types.ts"

export interface StoredObject<Schemas extends SchemaMap> extends StoredValue<
  ObjectSnapshot<Schemas>
> {
  field<Key extends keyof Schemas & string>(key: Key): StoredValueOf<Schemas[Key]>
}

export type SchemaMap = Readonly<Record<string, AnySchema>> & { id?: never; type?: never }

export type ObjectSnapshot<Schemas extends SchemaMap> = {
  readonly [Key in keyof Schemas]: SnapshotOf<Schemas[Key]>
}

export function object<Schemas extends SchemaMap>(
  schemas: Schemas,
): Schema<ObjectSnapshot<Schemas>, StoredObject<Schemas>, "map"> {
  return {
    create(store, snapshot) {
      const fields = Object.fromEntries(
        Object.entries(schemas).map(([key, schema]) => {
          if (!Object.hasOwn(snapshot, key)) {
            throw new TypeError(`Missing required field: ${key}.`)
          }
          const value = snapshot[key as keyof typeof snapshot]
          if (value === undefined) {
            throw new TypeError(`Undefined field: ${key}.`)
          }
          return [key, schema.create(store, value)]
        }),
      )
      return store.map.create(fields)
    },

    bind(store, ref) {
      const field = <Key extends keyof Schemas & string>(key: Key): StoredValueOf<Schemas[Key]> => {
        if (!Object.hasOwn(schemas, key)) {
          throw new TypeError(`Unknown field: ${key}.`)
        }
        const childRef = store.map.getField(ref, key)
        if (childRef === undefined) {
          throw new TypeError(`Missing required field: ${key}.`)
        }
        return schemas[key]!.bind(store, childRef) as StoredValueOf<Schemas[Key]>
      }

      return {
        field,

        snapshot() {
          return Object.fromEntries(
            Object.keys(schemas).map((key) => [key, field(key).snapshot()]),
          ) as ObjectSnapshot<Schemas>
        },
      }
    },
  }
}
