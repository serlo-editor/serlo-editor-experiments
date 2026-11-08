import { isObject } from "../utils/guard.ts"
import type { TaggedObjectDefinition } from "./tagged-object.ts"
import type { Schema, SnapshotOf, StoredValueOf } from "./types.ts"

export function discriminatedUnion<const Definitions extends readonly TaggedObjectDefinition[]>(
  definitions: Definitions,
): Schema<SnapshotOf<Definitions[number]>, StoredValueOf<Definitions[number]>, "map"> {
  const byType = new Map<string, Definitions[number]>()
  if (definitions.length === 0) throw new TypeError("Expected at least one typed definition.")
  for (const definition of definitions) {
    if (byType.has(definition.type)) throw new TypeError(`Duplicate type: ${definition.type}.`)
    byType.set(definition.type, definition)
  }

  const select = (type: string): Definitions[number] => {
    const definition = byType.get(type)
    if (!definition) throw new TypeError(`Unknown child type: ${type}.`)
    return definition
  }

  return {
    create(store, snapshot) {
      const value: unknown = snapshot
      if (!isObject(value) || !Object.hasOwn(value, "type") || typeof value.type !== "string") {
        throw new TypeError("Expected child type.")
      }
      return select(value.type).create(store, snapshot)
    },
    bind(store, ref) {
      const typeRef = store.map.getField(ref, "type")
      const type = typeRef === undefined ? undefined : store.cell.get(typeRef)
      if (typeof type !== "string") throw new TypeError("Expected child type.")
      // TODO: try to avoid type cast here
      return select(type).bind(store, ref) as StoredValueOf<Definitions[number]>
    },
  }
}
