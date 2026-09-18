import {
  object,
  string,
  type JSONValueOf,
  type ObjectSchema,
  type Schema,
  type SchemaProperties,
  type SchemaVisitor,
  type ValueOf,
} from "./index.ts"
import { Storage, type SchemaExtension, type StorageRef } from "./storage.ts"

type AnyObjectSchema = ObjectSchema<SchemaProperties>
type AnyEducationalUnitDefinition = EducationalUnitDefinition

export type UnitJSON<Definition extends EducationalUnitDefinition> = {
  id: string
  type: Definition["type"]
} & JSONValueOf<Definition["schema"]>

export type EducationalUnitValue<Definition extends EducationalUnitDefinition> = {
  readonly id: string
  readonly type: Definition["type"]
  readonly value: ValueOf<Definition["schema"]>
  render(): ReturnType<Definition["render"]>
}

export interface EducationalUnitDefinition<
  Type extends string = string,
  UnitSchema extends AnyObjectSchema = AnyObjectSchema,
  Context = unknown,
  Node = unknown,
> {
  readonly type: Type
  readonly schema: UnitSchema
  readonly storageSchema: AnyObjectSchema
  render(
    unit: EducationalUnitValue<EducationalUnitDefinition<Type, UnitSchema, Context, Node>>,
    context: Context,
  ): Node
}

export type UnitValueOf<Definition extends AnyEducationalUnitDefinition> =
  Definition extends AnyEducationalUnitDefinition ? EducationalUnitValue<Definition> : never

export interface ChildSchema<
  Definitions extends readonly AnyEducationalUnitDefinition[] =
    readonly AnyEducationalUnitDefinition[],
> extends Schema<UnitValueOf<Definitions[number]>, UnitJSON<Definitions[number]>> {
  readonly kind: "child"
  readonly units: Definitions
}

export const educationalUnit = <
  const Type extends string,
  const UnitSchema extends AnyObjectSchema,
  Context = unknown,
  Node = unknown,
>(definition: {
  type: Type
  schema: UnitSchema
  render: (
    unit: EducationalUnitValue<EducationalUnitDefinition<Type, UnitSchema, Context, Node>>,
    context: Context,
  ) => Node
}): EducationalUnitDefinition<Type, UnitSchema, Context, Node> => {
  if ("id" in definition.schema.properties || "type" in definition.schema.properties) {
    throw new TypeError("Educational unit schema fields id and type are reserved")
  }

  return {
    ...definition,
    storageSchema: object({ id: string(), type: string(), ...definition.schema.properties }),
  }
}

export const child = <const Definitions extends readonly AnyEducationalUnitDefinition[]>(
  ...units: Definitions
): ChildSchema<Definitions> => {
  if (units.length === 0) throw new TypeError("child() needs at least one unit definition")

  return {
    kind: "child",
    units,
    visit<Input, Output>(visitor: SchemaVisitor<Input, Output>, input: Input): Output {
      return visitor.child(this, input)
    },
  }
}

type EducationalUnitReference<Ref, Definition extends AnyEducationalUnitDefinition> = Ref & {
  readonly __educationalUnit: Definition
}

const unitHeader = object({ id: string(), type: string() })

export class EducationalUnitStorage<
  Ref extends StorageRef,
  Definitions extends readonly AnyEducationalUnitDefinition[],
> {
  private readonly definitions = new Map<string, AnyEducationalUnitDefinition>()
  private readonly storage: Storage<Ref>

  constructor(storage: Storage<Ref>, units: Definitions) {
    this.storage = storage
    for (const unit of units) {
      if (this.definitions.has(unit.type)) {
        throw new TypeError(`Duplicate educational unit type: ${unit.type}`)
      }
      this.definitions.set(unit.type, unit)
    }
  }

  save<const Type extends Definitions[number]["type"]>(
    unit: UnitJSON<Definitions[number]> & { type: Type },
  ): EducationalUnitReference<Ref, Extract<Definitions[number], { type: Type }>> {
    return this.saveUnit(unit) as EducationalUnitReference<
      Ref,
      Extract<Definitions[number], { type: Type }>
    >
  }

  bind<Context, Definition extends Definitions[number]>(
    reference: EducationalUnitReference<Ref, Definition>,
    context: Context,
  ): UnitValueOf<Definition>
  bind<Context>(reference: Ref, context: Context): UnitValueOf<Definitions[number]>
  bind<Context>(reference: Ref, context: Context): UnitValueOf<Definitions[number]> {
    return this.bindUnit(reference, context) as UnitValueOf<Definitions[number]>
  }

  load<Definition extends Definitions[number]>(
    reference: EducationalUnitReference<Ref, Definition>,
  ): UnitJSON<Definition>
  load(reference: Ref): UnitJSON<Definitions[number]>
  load(reference: Ref): UnitJSON<Definitions[number]> {
    return this.loadUnit(reference) as UnitJSON<Definitions[number]>
  }

  private extension(context: unknown): SchemaExtension<Ref> {
    return {
      bind: (schema, reference) => this.bindChild(schema, reference, context),
      save: (schema, value) => this.saveChild(schema, value),
      load: (schema, reference) => this.loadChild(schema, reference),
    }
  }

  private saveUnit(value: unknown): Ref {
    const definition = this.definitionForJSON(value)
    return this.storage.save(
      definition.storageSchema,
      value as JSONValueOf<typeof definition.storageSchema>,
      this.extension(undefined),
    )
  }

  private bindUnit(
    reference: Ref,
    context: unknown,
  ): EducationalUnitValue<AnyEducationalUnitDefinition> {
    const { id, type, definition } = this.metadata(reference)
    const value = this.storage.bind(definition.schema, reference, this.extension(context))
    const unit = {
      id,
      type,
      value,
      render: () => definition.render(unit, context),
    } as EducationalUnitValue<AnyEducationalUnitDefinition>

    return unit
  }

  private loadUnit(reference: Ref): UnitJSON<AnyEducationalUnitDefinition> {
    const { id, type, definition } = this.metadata(reference)
    const fields = this.storage.load(definition.schema, reference, this.extension(undefined))
    return { id, type, ...fields }
  }

  private bindChild(schema: ChildSchema, reference: Ref, context: unknown): unknown {
    const unit = this.bindUnit(reference, context)
    this.assertAllowed(schema, unit.type)
    return unit
  }

  private saveChild(schema: ChildSchema, value: unknown): Ref {
    const definition = this.definitionForJSON(value)
    this.assertAllowed(schema, definition.type)
    return this.saveUnit(value)
  }

  private loadChild(schema: ChildSchema, reference: Ref): UnitJSON<AnyEducationalUnitDefinition> {
    const unit = this.loadUnit(reference)
    this.assertAllowed(schema, unit.type)
    return unit
  }

  private metadata(reference: Ref): {
    id: string
    type: string
    definition: AnyEducationalUnitDefinition
  } {
    const { id, type } = this.storage.load(unitHeader, reference)
    return { id, type, definition: this.definition(type) }
  }

  private definitionForJSON(value: unknown): AnyEducationalUnitDefinition {
    if (!isRecord(value) || typeof value.id !== "string" || typeof value.type !== "string") {
      throw new TypeError("Educational unit needs string id and type")
    }

    return this.definition(value.type)
  }

  private definition(type: string): AnyEducationalUnitDefinition {
    const definition = this.definitions.get(type)
    if (!definition) throw new TypeError(`Unknown educational unit type: ${type}`)
    return definition
  }

  private assertAllowed(schema: ChildSchema, type: string): void {
    if (!schema.units.some((unit) => unit.type === type)) {
      throw new TypeError(`Unit type ${type} is not allowed in this child field`)
    }
  }
}

export const createEducationalUnitStorage = <
  Ref extends StorageRef,
  const Definitions extends readonly AnyEducationalUnitDefinition[],
>(options: {
  storage: Storage<Ref>
  units: Definitions
}): EducationalUnitStorage<Ref, Definitions> =>
  new EducationalUnitStorage(options.storage, options.units)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
