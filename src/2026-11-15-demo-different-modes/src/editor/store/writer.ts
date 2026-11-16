import type { NodeRefs, NodeWriter } from "./types.ts"

export function withWriter<Refs extends NodeRefs, Result>(
  writer: NodeWriter<Refs>,
  callback: (write: NodeWriter<Refs>) => Result,
): Result {
  let active = true
  const write: NodeWriter<Refs> = {
    cell: { set: guard(writer.cell.set) },
    array: { remove: guard(writer.array.remove), insert: guard(writer.array.insert) },
    map: { set: guard(writer.map.set), remove: guard(writer.map.remove) },
    root: { save: guard(writer.root.save) },
  }

  try {
    return callback(write)
  } finally {
    active = false
  }

  function guard<Args extends unknown[], Value>(operation: (...args: Args) => Value) {
    return (...args: Args): Value => {
      if (!active) throw new Error("Invalid transaction.")
      return operation(...args)
    }
  }
}
