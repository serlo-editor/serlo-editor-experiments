import { createElement, type ReactNode } from "react"

import { isObject } from "../utils/guard.ts"
import { object, type ObjectHandle, type ObjectSnapshot, type SchemaMap } from "./object.ts"
import { string } from "./primitives.ts"
import type { HandleOf, Schema, SnapshotOf } from "./types.ts"

export type UnitSnapshot<Type extends string, Fields extends SchemaMap> = {
  readonly id: string
  readonly type: Type
} & ObjectSnapshot<Fields>

export interface UnitHandle<
  Type extends string,
  Fields extends SchemaMap,
> extends ObjectHandle<Fields> {
  readonly id: string
  readonly type: Type
  readonly definition: UnitDefinition<Type, Fields>
  snapshot(): UnitSnapshot<Type, Fields>
}

export interface UnitDefinition<Type extends string, Fields extends SchemaMap> extends Schema<
  UnitSnapshot<Type, Fields>,
  UnitHandle<Type, Fields>,
  "map"
> {
  readonly type: Type
  readonly fields: Fields
  render(props: { handle: UnitHandle<Type, Fields> }): ReactNode
}

// Parent owns rerender scheduling until subscription support is added.
//
// TODO: Add subscription support to allow child units to rerender themselves
// when their state changes to avoid rerenderiing the entire app.
export function UnitView({ handle }: { handle: UnitHandle<string, SchemaMap> }) {
  return createElement(handle.definition.render, { handle, key: handle.id })
}

/** Object schema with immutable identity, discriminator, and local renderer metadata. */
export function unit<const Type extends string, Fields extends SchemaMap>({
  type,
  fields,
  render,
}: {
  type: Type
  fields: Fields & { readonly id?: never; readonly type?: never }
  render: UnitDefinition<Type, Fields>["render"]
}): UnitDefinition<Type, Fields> {
  if (typeof type !== "string" || type.length === 0) throw new TypeError("Expected unit type.")
  for (const key of ["id", "type"]) {
    if (Object.hasOwn(fields, key)) throw new TypeError(`Reserved unit field: ${key}.`)
  }

  const contentSchema = object<Fields>(fields)
  const storageSchema = object({ ...fields, id: string(), type: string() })
  const definition: UnitDefinition<Type, Fields> = {
    type,
    fields,
    render,

    create(store, snapshot) {
      if (!isObject(snapshot)) throw new TypeError("Expected unit snapshot.")
      if (!Object.hasOwn(snapshot, "id") || typeof snapshot.id !== "string" || !snapshot.id) {
        throw new TypeError("Expected unit ID.")
      }
      if (!Object.hasOwn(snapshot, "type") || snapshot.type !== type) {
        throw new TypeError(`Expected unit type: ${type}.`)
      }
      for (const key of Object.keys(snapshot)) {
        if (key !== "id" && key !== "type" && !Object.hasOwn(fields, key)) {
          throw new TypeError(`Unknown field: ${key}.`)
        }
      }
      // Storage adds checked metadata to the same fields; TS cannot reduce generic mapped types.
      return storageSchema.create(store, snapshot as SnapshotOf<typeof storageSchema>)
    },

    bind(store, ref) {
      const refs = store.map.get(ref)
      const id = refs.id === undefined ? undefined : store.cell.get(refs.id)
      const storedType = refs.type === undefined ? undefined : store.cell.get(refs.type)
      if (typeof id !== "string" || !id) throw new TypeError("Expected unit ID.")
      if (storedType !== type) throw new TypeError(`Expected unit type: ${type}.`)
      const content = contentSchema.bind(store, ref)
      return {
        ...content,
        id,
        type,
        definition,
        snapshot: () => ({ id, type, ...content.snapshot() }),
      }
    },
  }
  return definition
}

/** New units receive fresh IDs. Loading complete snapshots does not regenerate them. */
export function createUnit<Type extends string, Fields extends SchemaMap>(
  definition: UnitDefinition<Type, Fields>,
  fields: NoInfer<ObjectSnapshot<Fields>>,
): UnitSnapshot<Type, Fields> {
  return { ...structuredClone(fields), id: crypto.randomUUID(), type: definition.type }
}

type AnyUnitDefinition = UnitDefinition<any, any>

/** Explicit union; each child carries its locally bound renderer definition. */
export function childUnit<const Definitions extends readonly AnyUnitDefinition[]>(
  definitions: Definitions,
): Schema<SnapshotOf<Definitions[number]>, HandleOf<Definitions[number]>, "map"> {
  const byType = new Map<string, Definitions[number]>()
  if (definitions.length === 0) throw new TypeError("Expected at least one child unit definition.")
  for (const definition of definitions) {
    if (byType.has(definition.type)) throw new TypeError(`Duplicate unit type: ${definition.type}.`)
    byType.set(definition.type, definition)
  }

  const select = (snapshot: unknown): Definitions[number] => {
    if (
      !isObject(snapshot) ||
      !Object.hasOwn(snapshot, "type") ||
      typeof snapshot.type !== "string"
    ) {
      throw new TypeError("Expected child unit type.")
    }
    const definition = byType.get(snapshot.type)
    if (!definition) throw new TypeError(`Unknown child unit type: ${snapshot.type}.`)
    return definition
  }

  return {
    create(store, snapshot) {
      // Selection erases the concrete member while preserving the public snapshot union.
      const schema: Schema<any, any, "map"> = select(snapshot)
      return schema.create(store, snapshot)
    },
    bind(store, ref) {
      const typeRef = store.map.get(ref).type
      const definition = select({
        type: typeRef === undefined ? undefined : store.cell.get(typeRef),
      })
      // Stored discriminator selects exactly one member of the inferred handle union.
      return definition.bind(store, ref) as HandleOf<Definitions[number]>
    },
  }
}
