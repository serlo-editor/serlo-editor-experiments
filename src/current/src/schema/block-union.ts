import { isObject } from "../utils/guard.ts"
import type { BlockDefinition } from "./block.ts"
import type { Schema, SnapshotOf, StoredValueOf } from "./types.ts"

type AnyBlockDefinition = BlockDefinition<any, any>

/** Explicit union; each child carries its locally bound renderer definition. */
export function blockUnion<const Definitions extends readonly AnyBlockDefinition[]>(
  definitions: Definitions,
): Schema<SnapshotOf<Definitions[number]>, StoredValueOf<Definitions[number]>, "map"> {
  const byType = new Map<string, Definitions[number]>()
  if (definitions.length === 0) throw new TypeError("Expected at least one child block definition.")
  for (const definition of definitions) {
    if (byType.has(definition.type))
      throw new TypeError(`Duplicate block type: ${definition.type}.`)
    byType.set(definition.type, definition)
  }

  const select = (snapshot: unknown): Definitions[number] => {
    if (
      !isObject(snapshot) ||
      !Object.hasOwn(snapshot, "type") ||
      typeof snapshot.type !== "string"
    ) {
      throw new TypeError("Expected child block type.")
    }
    const definition = byType.get(snapshot.type)
    if (!definition) throw new TypeError(`Unknown child block type: ${snapshot.type}.`)
    return definition
  }

  return {
    create(store, snapshot) {
      // Selection erases the concrete member while preserving the public snapshot union.
      const schema: Schema<any, any, "map"> = select(snapshot)
      return schema.create(store, snapshot)
    },
    bind(store, ref) {
      const typeRef = store.map.getField(ref, "type")
      const definition = select({
        type: typeRef === undefined ? undefined : store.cell.get(typeRef),
      })
      // Stored discriminator selects exactly one member of the inferred stored-value union.
      return definition.bind(store, ref) as StoredValueOf<Definitions[number]>
    },
  }
}
