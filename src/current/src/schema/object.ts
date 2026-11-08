import type { AnySchema, Schema, SnapshotOf, StoredValue, StoredValueOf } from "./types.ts"

export type StoredObject<Schemas extends SchemaMap> = StoredValue<ObjectSnapshot<Schemas>> & {
  field<Key extends keyof Schemas & string>(key: Key): StoredValueOf<Schemas[Key]>
} & {
  readonly [Key in keyof Schemas]: StoredValueOf<Schemas[Key]>
}

export type SchemaMap = Readonly<Record<string, AnySchema>>

export type ObjectSnapshot<Schemas extends SchemaMap> = {
  readonly [Key in keyof Schemas]: SnapshotOf<Schemas[Key]>
}

export function object<Schemas extends SchemaMap>(
  schemas: Schemas,
): Schema<ObjectSnapshot<Schemas>, StoredObject<Schemas>, "map"> {
  for (const key of ["field", "snapshot"]) {
    if (Object.hasOwn(schemas, key)) throw new TypeError(`Reserved object field: ${key}.`)
  }

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

      return Object.defineProperties(
        {
          field,
          snapshot() {
            return Object.fromEntries(
              Object.keys(schemas).map((key) => [key, field(key).snapshot()]),
            ) as ObjectSnapshot<Schemas>
          },
        },
        // Non-enumerable getters avoid reading removed fields during React prop inspection.
        Object.fromEntries(Object.keys(schemas).map((key) => [key, { get: () => field(key) }])),
      ) as StoredObject<Schemas>
    },
  }
}
