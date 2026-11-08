import type { AnySchema, Schema, SnapshotOf, StoredValue, StoredValueOf } from "./types.ts"

export type StoredObject<Schemas extends SchemaMap> = StoredValue<ObjectSnapshot<Schemas>> & {
  readonly [Key in keyof Schemas]: StoredValueOf<Schemas[Key]>
}

export type SchemaMap = Readonly<Record<string, AnySchema>> & { snapshot?: never }

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
      const child = (key: string) => {
        const childRef = store.map.getField(ref, key)
        if (childRef === undefined) throw new TypeError(`Missing required field: ${key}.`)
        return schemas[key]!.bind(store, childRef)
      }

      return Object.defineProperties(
        {
          snapshot() {
            return Object.fromEntries(
              Object.keys(schemas).map((key) => [key, child(key).snapshot()]),
            ) as ObjectSnapshot<Schemas>
          },
        },
        // Non-enumerable getters avoid reading removed fields during React prop inspection.
        Object.fromEntries(Object.keys(schemas).map((key) => [key, { get: () => child(key) }])),
      ) as StoredObject<Schemas>
    },
  }
}
