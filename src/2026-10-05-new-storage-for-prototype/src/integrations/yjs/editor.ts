import { type Awareness, defineYjs } from "prosekit/extensions/yjs"
import type * as Y from "yjs"

import type { RichTextDefinition } from "../../rich-text/definition.ts"
import { createRichTextEditor } from "../../rich-text/editor.ts"
import { getRichTextFragment } from "./rich-text.ts"

/** Convenience integration: binds a core editor to a stable Y.XmlFragment. */
export function createYjsRichTextEditor({
  definition,
  id,
  fragment,
  awareness,
  onViewUpdate,
}: {
  definition: RichTextDefinition
  id: string
  fragment: Y.XmlFragment
  awareness: Awareness
  onViewUpdate?: Parameters<typeof createRichTextEditor>[0]["onViewUpdate"]
}) {
  const doc = fragment.doc
  if (!doc || getRichTextFragment(doc, id) !== fragment) {
    throw new Error("Use the named fragment belonging to this rich-text ID.")
  }
  if (awareness.doc !== doc) {
    throw new Error("Awareness and fragment must belong to the same Y.Doc.")
  }

  return createRichTextEditor({
    definition,
    ...(onViewUpdate ? { onViewUpdate } : {}),
    extensions: [defineYjs({ doc, fragment, awareness: createEditorAwareness(id, awareness) })],
  })
}

/** Local proxy; shared awareness remains owned by the editor adapter. */
export function createEditorAwareness(id: string, awareness: Awareness): Awareness {
  const methods = {
    getStates() {
      return new Map([...awareness.getStates()].filter(([, state]) => state.editorId === id))
    },
    getLocalState() {
      const state = awareness.getLocalState()
      return state?.editorId === id ? state : null
    },
    setLocalStateField(field: string, value: unknown) {
      const state = awareness.getLocalState()
      if (value != null || state?.editorId === id) {
        awareness.setLocalState({ ...state, editorId: id, [field]: value })
      }
    },
  }

  return new Proxy(awareness, {
    get(target, property) {
      if (property === "getStates") return methods.getStates
      if (property === "getLocalState") return methods.getLocalState
      if (property === "setLocalStateField") return methods.setLocalStateField
      const value = Reflect.get(target, property, target)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
}
