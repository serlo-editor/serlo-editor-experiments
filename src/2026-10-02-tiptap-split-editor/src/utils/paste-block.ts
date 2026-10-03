import { Plugin, PluginKey } from "@tiptap/pm/state"

/**
 * A paste plugin for blocks: `insert` gets the pasted text when it is pasted
 * onto an empty paragraph, and says whether it made something of it. A link
 * pasted into a text is left alone, so the sentence keeps reading as one.
 */
export function pasteOnEmptyLine(name: string, insert: (text: string) => boolean) {
  return new Plugin({
    key: new PluginKey(name),
    props: {
      handlePaste(view, event) {
        const text = event.clipboardData?.getData("text/plain").trim()
        const { $from, empty } = view.state.selection
        const block = $from.parent
        if (!text || !empty || block.type.name !== "paragraph" || block.content.size) return false
        return insert(text)
      },
    },
  })
}
