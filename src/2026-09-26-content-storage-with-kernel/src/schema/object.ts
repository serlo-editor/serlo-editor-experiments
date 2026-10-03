import type { Handle, Schema } from "./types.ts"

type AnySchema = Schema<any, any, any>
type SchemaMap = Readonly<Record<string, AnySchema>>

type SnapshotOf<ChildSchema> =
  ChildSchema extends Schema<infer Snapshot, any, any> ? Snapshot : never

type HandleOf<ChildSchema> =
  ChildSchema extends Schema<any, infer ChildHandle, any> ? ChildHandle : never

type ObjectSnapshot<Schemas extends SchemaMap> = {
  readonly [Key in keyof Schemas]: SnapshotOf<Schemas[Key]>
}

type ObjectChildren<Schemas extends SchemaMap> = {
  readonly [Key in keyof Schemas]: HandleOf<Schemas[Key]>
}

export interface ObjectHandle<Schemas extends SchemaMap> extends Handle<ObjectSnapshot<Schemas>> {
  get<Key extends keyof Schemas>(key: Key): ObjectChildren<Schemas>[Key]
  set<Key extends keyof Schemas>(key: Key, snapshot: SnapshotOf<Schemas[Key]>): void
}

export function object<Schemas extends SchemaMap>(
  schemas: Schemas,
): Schema<ObjectSnapshot<Schemas>, ObjectHandle<Schemas>, "map"> {
  return {
    create(store, snapshot) {
      const fields: Record<string, any> = {}

      for (const key of Object.keys(schemas) as Array<keyof Schemas>) {
        fields[key as string] = schemas[key]!.create(store, snapshot[key]!)
      }

      return store.map.create(fields)
    },

    bind(store, ref) {
      const get = <Key extends keyof Schemas>(key: Key): ObjectChildren<Schemas>[Key] => {
        const childRef = store.map.get(ref)[key as string]!
        return schemas[key]!.bind(store, childRef) as ObjectChildren<Schemas>[Key]
      }

      return {
        get,

        set(key, snapshot) {
          const childRef = schemas[key]!.create(store, snapshot)
          store.transact((tx) => {
            store.map.edit(ref, tx).set(key as string, childRef)
          })
        },

        snapshot() {
          return Object.fromEntries(
            Object.keys(schemas).map((key) => [key, get(key).snapshot()]),
          ) as ObjectSnapshot<Schemas>
        },
      }
    },
  }
}
