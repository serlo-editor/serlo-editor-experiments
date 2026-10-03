import type { EditorView } from "@tiptap/pm/view"

/**
 * Which editors currently show the emoji suggestion list. `editorProps.
 * handleKeyDown` runs before any plugin, so the editor has to know when the
 * list is up to leave the arrow keys and Enter to it.
 */
const openViews = new WeakSet<EditorView>()

export function setEmojiListOpen(view: EditorView, isOpen: boolean) {
  if (isOpen) openViews.add(view)
  else openViews.delete(view)
}

export function isEmojiListOpen(view: EditorView) {
  return openViews.has(view)
}
