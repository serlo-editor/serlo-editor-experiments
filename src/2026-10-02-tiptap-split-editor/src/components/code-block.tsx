import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react"
import { createLowlight } from "lowlight"

import { CODE_GRAMMARS, CODE_LANGUAGES, resolveLanguage } from "@/utils/code-languages"

const lowlight = createLowlight()
lowlight.register(CODE_GRAMMARS)

function CodeBlockView({ node, updateAttributes, editor }: NodeViewProps) {
  const language = resolveLanguage(node.attrs.language as string | null)

  return (
    <NodeViewWrapper className="relative my-4">
      {editor.isEditable && (
        <select
          contentEditable={false}
          aria-label="Programmiersprache"
          value={language}
          onChange={(event) => updateAttributes({ language: event.target.value })}
          className="absolute right-2 top-2 rounded-md border border-sky-200 bg-white/80 px-1.5 py-0.5 text-xs text-neutral-600 focus:outline-none focus:ring-2 focus:ring-sky-300"
        >
          {CODE_LANGUAGES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      )}
      <pre>
        <NodeViewContent<"code"> as="code" />
      </pre>
    </NodeViewWrapper>
  )
}

/**
 * Rewrites language attributes we do not know (aliases like `js`, languages
 * from pasted code) to one of `CODE_LANGUAGES`, so the picker and the
 * highlighting never disagree.
 */
function normalizeLanguages(name: string) {
  return new Plugin({
    key: new PluginKey("normalizeCodeBlockLanguage"),
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((transaction) => transaction.docChanged)) return null
      const tr = newState.tr
      let hasChanges = false
      newState.doc.descendants((node, pos) => {
        if (node.type.name !== name) return
        const language = resolveLanguage(node.attrs.language as string | null)
        if (node.attrs.language === language) return
        tr.setNodeAttribute(pos, "language", language)
        hasChanges = true
      })
      return hasChanges ? tr : null
    },
  })
}

/** code block with lowlight highlighting and a language picker */
export const CodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },
  addProseMirrorPlugins() {
    return [...(this.parent?.() ?? []), normalizeLanguages(this.name)]
  },
}).configure({ lowlight, defaultLanguage: "plaintext" })
