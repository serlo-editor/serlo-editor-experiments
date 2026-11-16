import type { Awareness } from "prosekit/extensions/yjs"

/** Shares presence transport while keeping each editor's cursor isolated. */
export function createEditorSpecificAwareness(editorId: string, awareness: Awareness): Awareness {
  const matches = (state: object | null) =>
    state !== null && "editorId" in state && state.editorId === editorId

  const getStates: Awareness["getStates"] = () =>
    new Map([...awareness.getStates()].filter(([, state]) => matches(state)))

  const getLocalState: Awareness["getLocalState"] = () => {
    const state = awareness.getLocalState()
    return matches(state) ? state : null
  }

  const setLocalStateField: Awareness["setLocalStateField"] = (field, value) => {
    const state = awareness.getLocalState()
    if (value != null || matches(state)) {
      awareness.setLocalState({ ...state, editorId, [field]: value })
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
