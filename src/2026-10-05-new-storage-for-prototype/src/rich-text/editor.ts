import { createEditor, defineUpdateHandler, type UpdateHandler, union } from "prosekit/core"
import { type Awareness, defineYjs } from "prosekit/extensions/yjs"
import type * as Y from "yjs"

import { getRichTextFragment } from "./content.ts"
import { defineRichTextExtension, type RichTextDefinition } from "./definition.ts"

/** Creates a local editor only. Never initializes or replaces fragment content. */
export function createRichTextEditor({
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
  onViewUpdate?: UpdateHandler
}) {
  const doc = fragment.doc
  if (!doc || getRichTextFragment(doc, id) !== fragment) {
    throw new Error("Use the named fragment belonging to this rich-text ID.")
  }
  if (awareness.doc !== doc) {
    throw new Error("Awareness and fragment must belong to the same Y.Doc.")
  }

  return createEditor({
    extension: union(
      defineRichTextExtension(definition),
      ...(onViewUpdate ? [defineUpdateHandler(onViewUpdate)] : []),
      defineYjs({ doc, fragment, awareness: createEditorAwareness(id, awareness) }),
    ),
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
      // An old editor clearing its cursor must not steal another editor's focus.
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
