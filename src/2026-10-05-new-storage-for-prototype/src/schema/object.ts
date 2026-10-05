import type { Handle, HandleOf, Schema, SnapshotOf } from "./types.ts"

interface ObjectHandle<Schemas extends SchemaMap> extends Handle<ObjectSnapshot<Schemas>> {
  field<Key extends keyof Schemas & string>(key: Key): FieldHandle<Schemas[Key]>
  setOptional<Key extends OptionalKeys<Schemas> & string>(
    key: Key,
    value: SnapshotOf<ChildSchema<Schemas[Key]>>,
  ): void
  removeOptional<Key extends OptionalKeys<Schemas> & string>(key: Key): void
}

type AnySchema = Schema<any, any, any>
type SchemaMap = Readonly<Record<string, AnySchema | OptionalField<AnySchema>>>

interface OptionalField<Child extends AnySchema> {
  readonly optional: true
  readonly schema: Child
}

type ChildSchema<Field> = Field extends OptionalField<infer Child> ? Child : Field

type FieldHandle<Field> =
  Field extends OptionalField<infer Child> ? HandleOf<Child> | undefined : HandleOf<Field>

type OptionalKeys<Schemas extends SchemaMap> = {
  [Key in keyof Schemas]-?: Schemas[Key] extends OptionalField<AnySchema> ? Key : never
}[keyof Schemas]

type ObjectSnapshot<Schemas extends SchemaMap> = {
  readonly [Key in Exclude<keyof Schemas, OptionalKeys<Schemas>>]: SnapshotOf<Schemas[Key]>
} & {
  readonly [Key in OptionalKeys<Schemas>]?: SnapshotOf<ChildSchema<Schemas[Key]>>
}

export function object<Schemas extends SchemaMap>(
  schemas: Schemas,
): Schema<ObjectSnapshot<Schemas>, ObjectHandle<Schemas>, "map"> {
  return {
    create(store, snapshot) {
      const fields = Object.fromEntries(
        Object.entries(schemas).flatMap(([key, definition]) => {
          if (!Object.hasOwn(snapshot, key)) {
            if ("optional" in definition) return []
            throw new TypeError(`Missing required field: ${key}.`)
          }
          const value = snapshot[key as keyof typeof snapshot]
          if (value === undefined) {
            throw new TypeError(`Undefined field: ${key}.`)
          }
          const schema = "optional" in definition ? definition.schema : definition
          return [[key, schema.create(store, value)]]
        }),
      )
      return store.map.create(fields)
    },

    bind(store, ref) {
      const definitionOf = (key: string) => {
        if (!Object.hasOwn(schemas, key)) {
          throw new TypeError(`Unknown field: ${key}.`)
        }
        return schemas[key]!
      }

      const optionalSchema = (key: string) => {
        const definition = definitionOf(key)
        if (!("optional" in definition)) {
          throw new TypeError(`Field is not optional: ${key}.`)
        }
        return definition.schema
      }

      const field = <Key extends keyof Schemas & string>(key: Key): FieldHandle<Schemas[Key]> => {
        const definition = definitionOf(key)
        const fields = store.map.get(ref)
        if (!Object.hasOwn(fields, key)) {
          if ("optional" in definition) return undefined as FieldHandle<Schemas[Key]>
          throw new TypeError(`Missing required field: ${key}.`)
        }
        const schema = "optional" in definition ? definition.schema : definition
        return schema.bind(store, fields[key]!) as FieldHandle<Schemas[Key]>
      }

      return {
        field,

        setOptional(key, value) {
          const schema = optionalSchema(key)
          if (value === undefined) {
            throw new TypeError(`Undefined field: ${key}.`)
          }
          const childRef = schema.create(store, value)
          store.transact((tx) => store.map.edit(ref, tx).set(key, childRef))
        },

        removeOptional(key) {
          optionalSchema(key)
          store.transact((tx) => store.map.edit(ref, tx).remove(key))
        },

        snapshot() {
          return Object.fromEntries(
            Object.keys(schemas).flatMap((key) => {
              const child = field(key)
              return child === undefined ? [] : [[key, (child as Handle<any>).snapshot()]]
            }),
          ) as ObjectSnapshot<Schemas>
        },
      }
    },
  }
}

/** Marks an object field as optional; absent fields have no storage entry. */
export function optional<Child extends AnySchema>(schema: Child): OptionalField<Child> {
  return { optional: true, schema }
}
