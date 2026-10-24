import { DOMSerializer } from "prosekit/pm/model"
import { useCallback, useEffect, useRef } from "react"

import type { EditorSession } from "../editor"
import { ExerciseBadge } from "../editor/components/ExerciseBadge"
import type { ContentHandle } from "../editor/content"
import type { RichTextHandle } from "../editor/schema/rich-text"
import { useStorage } from "../editor/use-storage"

export function Preview({ session }: { session: EditorSession }) {
  useStorage(session.store)
  return (
    <div className="learner-content" aria-label="Lernvorschau">
      {session.document.root.map((handle) => (
        <PreviewUnit key={handle.id} handle={handle} />
      ))}
    </div>
  )
}

function PreviewUnit({ handle }: { handle: ContentHandle }) {
  switch (handle.type) {
    case "text":
      return <PreviewRichText handle={handle.field("content")} />
    case "fill-in-the-blank":
      return (
        <section className="exercise">
          <ExerciseBadge label="Lückentext" help="Tippe die richtigen Antworten in die Lücken." />
          <p className="exercise__instructions">Tippe die richtigen Antworten in die Lücken</p>
          <PreviewRichText handle={handle.field("content")} />
        </section>
      )
    case "multiple-choice": {
      const question = handle.field("question")
      const hasQuestion = question.getEditor().state.doc.textContent.trim().length > 0
      return (
        <section className="exercise">
          <ExerciseBadge label="Multiple Choice" help="Wähle alle passenden Antworten aus." />
          {hasQuestion && (
            <div className="exercise__prompt">
              <PreviewRichText handle={question} inline />
            </div>
          )}
          <div className="choice-options">
            {handle.field("options").map((option) => {
              const text = option.field("text")
              return (
                <label key={text.id} className="choice-card">
                  <PreviewRichText handle={text} inline />
                  <input type="checkbox" />
                </label>
              )
            })}
          </div>
        </section>
      )
    }
  }
}

function PreviewRichText({ handle, inline = false }: { handle: RichTextHandle; inline?: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const setHost = useCallback((element: HTMLElement | null) => {
    ref.current = element
  }, [])
  const HTMLTag = inline ? "span" : "div"
  const schema = handle.getEditor().schema
  const content = JSON.stringify(handle.snapshot())

  useEffect(() => {
    const fragment = DOMSerializer.fromSchema(schema).serializeFragment(
      schema.nodeFromJSON(JSON.parse(content)).content,
    )
    fragment.querySelectorAll(".gap-mark").forEach((gap, index) => {
      const input = document.createElement("input")
      input.type = "text"
      input.className = "preview-gap"
      input.setAttribute("aria-label", `Lücke ${index + 1}`)
      input.autocomplete = "off"
      gap.replaceWith(input)
    })
    ref.current?.replaceChildren(fragment)
  }, [content, schema])

  // Keep serialized DOM and learner answers outside React's editable content tree.
  return <HTMLTag ref={setHost} className="preview-rich-text" />
}
