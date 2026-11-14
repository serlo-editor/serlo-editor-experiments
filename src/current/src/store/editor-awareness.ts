import type { Awareness } from "prosekit/extensions/yjs"

import type { RichTextId } from "./types.ts"

/** Shares presence transport while keeping each editor's cursor isolated. */
export function createEditorSpecificAwareness(id: RichTextId, awareness: Awareness): Awareness {
  const getStates: Awareness["getStates"] = () =>
    new Map([...awareness.getStates()].filter(([, state]) => hasEditorId(state, id)))

  const getLocalState: Awareness["getLocalState"] = () => {
    const state = awareness.getLocalState()
    return hasEditorId(state, id) ? state : null
  }

  const setLocalStateField: Awareness["setLocalStateField"] = (field, value) => {
    const state = awareness.getLocalState()
    if (value != null || hasEditorId(state, id)) {
      awareness.setLocalState({ ...state, editorId: id, [field]: value })
    }
  }

  return new Proxy(awareness, {
    get(target, property, receiver) {
      switch (property) {
        case "getStates":
          return getStates
        case "getLocalState":
          return getLocalState
        case "setLocalStateField":
          return setLocalStateField
        default:
          return Reflect.get(target, property, receiver)
      }
    },
  })
}

function hasEditorId(state: object | null, id: RichTextId): boolean {
  return state !== null && "editorId" in state && state.editorId === id
}
