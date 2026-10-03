import type { Handle, Schema } from "./types.ts"

export interface ObjectHandle<Schemas extends SchemaMap> extends Handle<ObjectSnapshot<Schemas>> {
  field<Key extends keyof Schemas & string>(key: Key): HandleOf<Schemas[Key]>
}

export function object<Schemas extends SchemaMap>(
  schemas: Schemas,
): Schema<ObjectSnapshot<Schemas>, ObjectHandle<Schemas>, "map"> {
  return {
    create(store, snapshot) {
      return store.map.create(
        Object.fromEntries(
          Object.entries(schemas).map(([key, schema]) => [
            key,
            schema.create(store, snapshot[key]!),
          ]),
        ),
      )
    },

    bind(store, ref) {
      const field = <Key extends keyof Schemas & string>(key: Key): HandleOf<Schemas[Key]> => {
        const childRef = store.map.get(ref)[key]!
        return schemas[key]!.bind(store, childRef) as HandleOf<Schemas[Key]>
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

type SchemaMap = Readonly<Record<string, Schema<any, any, any>>>

type ObjectSnapshot<Schemas extends SchemaMap> = {
  readonly [Key in keyof Schemas]: SnapshotOf<Schemas[Key]>
}

type SnapshotOf<ChildSchema> =
  ChildSchema extends Schema<infer Snapshot, any, any> ? Snapshot : never

type HandleOf<ChildSchema> =
  ChildSchema extends Schema<any, infer ChildHandle, any> ? ChildHandle : never
