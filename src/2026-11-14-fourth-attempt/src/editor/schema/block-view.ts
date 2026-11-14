import { createElement } from "react"

import type { StoredBlock } from "./block.ts"

// Parent owns rerender scheduling until subscription support is added.
//
// TODO: Add subscription support so child blocks can rerender themselves when state changes.
export function BlockView({ value }: { value: StoredBlock<string, {}> }) {
  return createElement(value.definition.render, { value, key: value.id })
}
