import { createElement, type ReactNode } from "react"

import type { StoredBlock } from "./block.ts"
import type { SchemaMap } from "./object.ts"

// Parent owns rerender scheduling until subscription support is added.
//
// TODO: Add subscription support so child blocks can rerender themselves when state changes.
export function BlockView({ value }: { value: StoredBlock<string, SchemaMap> }): ReactNode {
  return createElement(value.definition.render, { value, key: value.id })
}
