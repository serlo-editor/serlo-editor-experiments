import type { ChildSchema } from "./educational-units.ts"
import type {
  ArraySchema,
  ArrayValue,
  BooleanSchema,
  JSONValueOf,
  ObjectSchema,
  Schema,
  SchemaProperties,
  SchemaVisitor,
  StringSchema,
  Value,
  ValueOf,
} from "./index.ts"

export type StorageRef = { readonly __storageRef: true }

export interface SchemaExtension<Ref extends StorageRef> {
  bind(schema: ChildSchema, reference: Ref): unknown
  save(schema: ChildSchema, value: unknown): Ref
  load(schema: ChildSchema, reference: Ref): unknown
}

type BooleanStorageAdapter<Ref extends StorageRef> = {
  create(value: boolean): Ref
  get(reference: Ref): boolean
  set(reference: Ref, value: boolean): void
}

type StringStorageAdapter<Ref extends StorageRef> = {
  create(value: string): Ref
  get(reference: Ref): string
  set(reference: Ref, value: string): void
}

type ArrayStorageAdapter<Ref extends StorageRef> = {
  create(children: Ref[]): Ref
  getElementReferences(reference: Ref): Ref[]
}

type ObjectStorageAdapter<Ref extends StorageRef> = {
  create(properties: Record<string, Ref>): Ref
  getPropertyReferences(reference: Ref): Record<string, Ref>
}

interface StorageAdapter<Ref extends StorageRef> {
  boolean(): BooleanStorageAdapter<Ref>
  string(): StringStorageAdapter<Ref>
  array(): ArrayStorageAdapter<Ref>
  object(): ObjectStorageAdapter<Ref>
  attach(reference: Ref): void
}

export class Storage<Ref extends StorageRef = StorageRef> {
  private readonly adapter: StorageAdapter<Ref>

  constructor(adapter: StorageAdapter<Ref>) {
    this.adapter = adapter
  }

  bind<S extends Schema<unknown>>(
    schema: S,
    reference: Ref,
    extension?: SchemaExtension<Ref>,
  ): ValueOf<S>
  bind(schema: Schema<unknown>, reference: Ref, extension?: SchemaExtension<Ref>): Value {
    const visitor: SchemaVisitor<Ref, Value> = {
      boolean: (_schema: BooleanSchema, ref) => ({
        get: () => this.adapter.boolean().get(ref),
        set: (value: boolean) => this.adapter.boolean().set(ref, value),
      }),
      string: (_schema: StringSchema, ref) => ({
        get: () => this.adapter.string().get(ref),
        set: (value: string) => this.adapter.string().set(ref, value),
      }),
      array: (schema: ArraySchema<Schema<unknown>>, ref) => {
        const adapter = this.adapter.array()
        const bind = (elementRef: Ref) => this.bind(schema.element, elementRef, extension)

        return {
          get length() {
            return adapter.getElementReferences(ref).length
          },
          at: (index: number) => bind(adapter.getElementReferences(ref)[index]!),
          map: <R>(fn: (value: ValueOf<typeof schema.element>, index: number) => R) =>
            adapter
              .getElementReferences(ref)
              .map((elementRef, index) => fn(bind(elementRef), index)),
        } satisfies ArrayValue<ValueOf<typeof schema.element>>
      },
      object: (schema: ObjectSchema<SchemaProperties>, ref) => {
        const propertyReferences = this.adapter.object().getPropertyReferences(ref)

        return Object.fromEntries(
          Object.entries(schema.properties).map(([key, propertySchema]) => [
            key,
            this.bind(propertySchema, propertyReferences[key]!, extension),
          ]),
        ) as Value
      },
      child: (schema, ref) => this.extension(extension).bind(schema, ref) as Value,
    }

    return schema.visit(visitor, reference)
  }

  save<S extends Schema<unknown>>(
    schema: S,
    value: JSONValueOf<S>,
    extension?: SchemaExtension<Ref>,
  ): Ref {
    const reference = this.saveInternal(schema, value, extension)
    this.adapter.attach(reference)
    return reference
  }

  private saveInternal<S extends Schema<unknown>>(
    schema: S,
    value: JSONValueOf<S>,
    extension?: SchemaExtension<Ref>,
  ): Ref {
    const visitor: SchemaVisitor<unknown, Ref> = {
      boolean: (_schema, value) => {
        if (typeof value !== "boolean") throw new TypeError("Expected boolean value")

        return this.adapter.boolean().create(value)
      },
      string: (_schema, value) => {
        if (typeof value !== "string") throw new TypeError("Expected string value")

        return this.adapter.string().create(value)
      },
      array: (schema, value) => {
        if (!Array.isArray(value)) throw new TypeError("Expected array value")

        const elementRefs = value.map((elementValue) =>
          this.saveInternal(schema.element, elementValue, extension),
        )
        return this.adapter.array().create(elementRefs)
      },
      object: (schema, value) => {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          throw new TypeError("Expected object value")
        }

        const propertyRefs: Record<string, Ref> = {}
        const properties = value as Record<string, unknown>
        for (const [key, propertySchema] of Object.entries(schema.properties)) {
          propertyRefs[key] = this.saveInternal(propertySchema, properties[key], extension)
        }

        return this.adapter.object().create(propertyRefs)
      },
      child: (schema, childValue) => this.extension(extension).save(schema, childValue),
    }

    return schema.visit(visitor, value)
  }

  load<S extends Schema<unknown>>(
    schema: S,
    reference: Ref,
    extension?: SchemaExtension<Ref>,
  ): JSONValueOf<S>
  load(schema: Schema<unknown>, reference: Ref, extension?: SchemaExtension<Ref>): unknown {
    const visitor: SchemaVisitor<Ref, unknown> = {
      boolean: (_schema, ref) => this.adapter.boolean().get(ref),
      string: (_schema, ref) => this.adapter.string().get(ref),
      array: (schema, ref) =>
        this.adapter
          .array()
          .getElementReferences(ref)
          .map((elementRef) => this.load(schema.element, elementRef, extension)),
      object: (schema, ref) => {
        const propertyReferences = this.adapter.object().getPropertyReferences(ref)

        return Object.fromEntries(
          Object.entries(schema.properties).map(([key, propertySchema]) => [
            key,
            this.load(propertySchema, propertyReferences[key]!, extension),
          ]),
        )
      },
      child: (schema, ref) => this.extension(extension).load(schema, ref),
    }

    return schema.visit(visitor, reference)
  }

  private extension(extension: SchemaExtension<Ref> | undefined): SchemaExtension<Ref> {
    if (!extension) throw new Error("Child schema needs educational unit storage")
    return extension
  }
}

export type FlatStorageRef = string & { readonly __storageRef: true }

type FlatStoredValue = boolean | string | FlatStorageRef[] | Record<string, FlatStorageRef>

export class FlatStorageAdapter implements StorageAdapter<FlatStorageRef> {
  private readonly storage = new Map<string, FlatStoredValue>()

  attach(_reference: FlatStorageRef): void {}

  boolean(): BooleanStorageAdapter<FlatStorageRef> {
    return {
      create: (value) => this.create("boolean", value),
      get: (reference) => {
        const value = this.storage.get(reference)
        if (typeof value !== "boolean") throw new TypeError("Expected boolean value")
        return value
      },
      set: (reference, value) => this.storage.set(reference, value),
    }
  }

  string(): StringStorageAdapter<FlatStorageRef> {
    return {
      create: (value) => this.create("string", value),
      get: (reference) => {
        const value = this.storage.get(reference)
        if (typeof value !== "string") throw new TypeError("Expected string value")
        return value
      },
      set: (reference, value) => this.storage.set(reference, value),
    }
  }

  array(): ArrayStorageAdapter<FlatStorageRef> {
    return {
      create: (children) => this.create("array", children),
      getElementReferences: (reference) => {
        const value = this.storage.get(reference)
        if (!Array.isArray(value)) throw new TypeError("Expected array value")
        return value
      },
    }
  }

  object(): ObjectStorageAdapter<FlatStorageRef> {
    return {
      create: (properties) => this.create("object", properties),
      getPropertyReferences: (reference) => {
        const value = this.storage.get(reference)
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          throw new TypeError("Expected object value")
        }
        return value
      },
    }
  }

  private create(kind: string, value: FlatStoredValue): FlatStorageRef {
    const reference = `${kind}:${Math.random().toString(36).slice(2)}` as FlatStorageRef
    this.storage.set(reference, value)
    return reference
  }
}
