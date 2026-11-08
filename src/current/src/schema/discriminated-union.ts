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

  const select = (snapshot: unknown): Definitions[number] => {
    if (
      !isObject(snapshot) ||
      !Object.hasOwn(snapshot, "type") ||
      typeof snapshot.type !== "string"
    ) {
      throw new TypeError("Expected child type.")
    }
    const definition = byType.get(snapshot.type)
    if (!definition) throw new TypeError(`Unknown child type: ${snapshot.type}.`)
    return definition
  }

  return {
    create(store, snapshot) {
      return select(snapshot).create(store, snapshot)
    },
    bind(store, ref) {
      const typeRef = store.map.getField(ref, "type")
      const definition = select({
        type: typeRef === undefined ? undefined : store.cell.get(typeRef),
      })
      // TODO: try to avoid type cast here
      return definition.bind(store, ref) as StoredValueOf<Definitions[number]>
    },
  }
}
