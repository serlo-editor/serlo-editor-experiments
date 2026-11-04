import { DOMSerializer } from "prosekit/pm/model"
import { useCallback, useLayoutEffect, useRef } from "react"

import { setGapAnswer } from "../responses"
import type { StoredRichText } from "../schema/rich-text"
import { useWorksheet } from "../worksheet-context"

/** Serialize content without mounting another ProseMirror view. */
export function StaticRichText({
  value,
  inline = false,
}: {
  value: StoredRichText
  inline?: boolean
}) {
  const host = useRef<HTMLElement>(null)
  const setHost = useCallback((element: HTMLElement | null) => {
    host.current = element
  }, [])
  const schema = value.getEditor().schema
  const content = JSON.stringify(value.snapshot())
  const Tag = inline ? "span" : "div"
  useLayoutEffect(() => {
    const fragment = DOMSerializer.fromSchema(schema).serializeFragment(
      schema.nodeFromJSON(JSON.parse(content)).content,
    )
    host.current?.replaceChildren(fragment)
  }, [content, schema])
  return <Tag ref={setHost} className="preview-rich-text" />
}

export function GapText({ value, exerciseId }: { value: StoredRichText; exerciseId: string }) {
  const { mode, answers } = useWorksheet()
  const answer = answers?.document.root.get(exerciseId)
  if (answer && answer.type !== "gap-answer")
    return <p role="alert">Antwort passt nicht zur Aufgabe.</p>
  return (
    <GapInputs
      value={value}
      values={answer?.field("values").snapshot() ?? {}}
      disabled={mode !== "answering" || !answers}
      onChange={(gapId, text) => {
        if (mode === "answering" && answers)
          setGapAnswer(answers.document.root, exerciseId, gapId, text)
      }}
    />
  )
}

function GapInputs({
  value,
  values,
  disabled,
  onChange,
}: {
  value: StoredRichText
  values: Readonly<Record<string, string>>
  disabled: boolean
  onChange: (gapId: string, text: string) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const inputs = useRef(new Map<string, HTMLInputElement>())
  const change = useRef(onChange)
  const schema = value.getEditor().schema
  const content = JSON.stringify(value.snapshot())
  useLayoutEffect(() => {
    change.current = onChange
  }, [onChange])

  // Rebuild only when authored content changes, never on keystrokes: preserve focus/selection.
  useLayoutEffect(() => {
    const fragment = DOMSerializer.fromSchema(schema).serializeFragment(
      schema.nodeFromJSON(JSON.parse(content)).content,
    )
    inputs.current.clear()
    fragment.querySelectorAll<HTMLElement>(".gap-mark").forEach((gap) => {
      const id = gap.dataset.gapId
      if (!id) throw new Error("Gap has no stable ID.")
      // Other marks can split one logical gap into several adjacent serialized spans.
      if (inputs.current.has(id)) {
        gap.remove()
        return
      }
      const input = document.createElement("input")
      input.type = "text"
      input.className = "preview-gap"
      input.setAttribute("aria-label", `Lücke ${inputs.current.size + 1}`)
      input.autocomplete = "off"
      input.addEventListener("input", () => change.current(id, input.value))
      inputs.current.set(id, input)
      gap.replaceWith(input)
    })
    host.current?.replaceChildren(fragment)
    return () => {
      inputs.current.clear()
      host.current?.replaceChildren()
    }
  }, [content, schema])

  useLayoutEffect(() => {
    for (const [id, input] of inputs.current) {
      const text = values[id] ?? ""
      if (input.value !== text) input.value = text
      input.disabled = disabled
    }
  }, [content, schema, values, disabled])
  return <div ref={host} className="preview-rich-text" />
}
