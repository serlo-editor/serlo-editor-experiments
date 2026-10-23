import { createElement } from "react"

import type { SchemaMap } from "../schema/object.ts"
import type { UnitHandle } from "../schema/unit.ts"

/** Parent owns rerender scheduling until subscription support is added. */
export function UnitView({ handle }: { handle: UnitHandle<string, SchemaMap> }) {
  return createElement(handle.definition.render, { handle, key: handle.id })
}
