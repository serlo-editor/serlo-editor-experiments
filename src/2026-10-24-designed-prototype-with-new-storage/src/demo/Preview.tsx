import { DOMSerializer } from "prosekit/pm/model"
import { type ReactNode, useEffect, useRef } from "react"
import { yXmlFragmentToProseMirrorRootNode } from "y-prosemirror"

import type { CDRT } from "../editor"
import { ExerciseBadge } from "../editor/components/ExerciseBadge"
import * as F from "../editor/nodes/flat"
import { isInline } from "../editor/rich-text/types"
import type { RichTextSchema } from "../editor/schema"
import type { EditorStore } from "../editor/store/editor-store"
import type { Key } from "../editor/store/key"
import { useEditorStore } from "../editor/store/use-editor-store"

const ROOT_KEY = "root" as Key

export function Preview({ cdrt }: { cdrt: CDRT }) {
  const { store } = useEditorStore(cdrt)

  return (
    <div className="learner-content" aria-label="Lernvorschau">
      {store.has(ROOT_KEY) ? previewNode(store.get(ROOT_KEY), store) : "Loading..."}
    </div>
  )
}

function previewNode(node: F.FlatNode, store: EditorStore): ReactNode {
  if (F.isRichText(node)) {
    return <PreviewRichText key={node.key} node={node} store={store} />
  }

  if (F.isWrapper(node) && node.schema.name === "FillInTheBlankExercise") {
    return (
      <section key={node.key} className="exercise">
        <ExerciseBadge label="Lückentext" help="Tippe die richtigen Antworten in die Lücken." />
        <p className="exercise__instructions">Tippe die richtigen Antworten in die Lücken</p>
        {previewNode(F.getSingletonChild({ node, store }), store)}
      </section>
    )
  }

  if (F.isObject(node) && node.schema.name === "MultipleChoiceExercise") {
    const question = F.getProperty({ node, store, propertyName: "question" })
    const options = F.getProperty({ node, store, propertyName: "options" })
    const hasQuestion =
      F.isRichText(question) &&
      yXmlFragmentToProseMirrorRootNode(
        store.getEditorFragment(question.key),
        store.getEditor(question).schema,
      ).textContent.trim().length > 0

    return (
      <section key={node.key} className="exercise">
        <ExerciseBadge label="Multiple Choice" help="Wähle alle passenden Antworten aus." />
        {hasQuestion && <div className="exercise__prompt">{previewNode(question, store)}</div>}
        <div className="choice-options">
          {F.isArray(options) &&
            F.getVisibleChildren({ node: options, store }).map((option) => {
              if (!F.isObject(option)) return null
              const text = F.getProperty({ node: option, store, propertyName: "text" })

              return (
                <label key={option.key} className="choice-card">
                  {previewNode(text, store)}
                  <input type="checkbox" />
                </label>
              )
            })}
        </div>
      </section>
    )
  }

  if (F.isSingleton(node)) {
    return previewNode(F.getSingletonChild({ node, store }), store)
  }

  if (F.isArray(node)) {
    return F.getVisibleChildren({ node, store }).map((child) => previewNode(child, store))
  }

  return null
}

function PreviewRichText({
  node,
  store,
}: {
  node: F.FlatNode<RichTextSchema>
  store: EditorStore
}) {
  const ref = useRef<HTMLDivElement>(null)
  const schema = store.getEditor(node).schema
  const doc = yXmlFragmentToProseMirrorRootNode(store.getEditorFragment(node.key), schema)
  const content = JSON.stringify(doc.toJSON())
  const HTMLTag = isInline(node.schema.features) ? "span" : "div"

  useEffect(() => {
    const fragment = DOMSerializer.fromSchema(schema).serializeFragment(
      schema.nodeFromJSON(JSON.parse(content)).content,
    )
    const container = ref.current
    if (!container) return

    fragment.querySelectorAll(".gap-mark").forEach((gap, index) => {
      const input = document.createElement("input")
      input.type = "text"
      input.className = "preview-gap"
      input.setAttribute("aria-label", `Lücke ${index + 1}`)
      input.autocomplete = "off"
      gap.replaceWith(input)
    })
    container.replaceChildren(fragment)
  }, [content, schema])

  return <HTMLTag ref={ref} className="preview-rich-text" />
}
