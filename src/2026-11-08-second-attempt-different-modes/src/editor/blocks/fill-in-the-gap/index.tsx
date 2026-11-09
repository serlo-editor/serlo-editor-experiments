import { useLayoutEffect, useRef } from "react"

import { ExerciseBadge } from "../../components/ExerciseBadge"
import { RichText } from "../../components/RichText"
import { serializeContent } from "../../components/StaticRichText"
import { richText as definition } from "../../rich-text"
import { exercise, isTaggedObject, record, richText, string } from "../../schema"
import type { StoredBlock } from "../../schema/block"
import type { StoredRichText } from "../../schema/rich-text"
import type { StoredTaggedObject } from "../../schema/tagged-object"
import { WorksheetMode } from "../../worksheet"
import { useWorksheet } from "../../worksheet-context"
import { ExerciseFeedback, feedbackFields, feedbackText } from "../shared/feedback"

const gapDefinition = definition.block({
  marks: { bold: true, italic: true, gap: true },
  blocks: { paragraph: true },
})
const gapUnitFields = { content: richText({ definition: gapDefinition }) }
const gapAnswerFields = { values: record(string()) }

export const FillInTheGapExercise = exercise({
  unit: { type: "fill-in-the-blank", fields: gapUnitFields },
  answer: { fields: gapAnswerFields },
  feedback: { fields: feedbackFields },
  grade: (unit, answer) => ({
    type: unit.type,
    comment: feedbackText(),
    result: "automatic",
    automaticResult: gradeGap(unit, answer),
  }),
  render: GapView,
})

function GapView({
  unit,
  answer,
  feedback,
  mode,
}: {
  unit: StoredBlock<"fill-in-the-blank", typeof gapUnitFields>
  answer: StoredTaggedObject<"fill-in-the-blank", typeof gapAnswerFields> | undefined
  feedback: StoredTaggedObject<"fill-in-the-blank", typeof feedbackFields> | undefined
  mode: WorksheetMode
}) {
  return (
    <section className="exercise exercise--fill-blank">
      <ExerciseBadge
        label="Lückentext"
        help={
          mode === WorksheetMode.EditingContent
            ? "Markiere Wörter als Lücken mit der Gap-Funktion."
            : "Tippe die richtigen Antworten in die Lücken."
        }
      />
      {mode === WorksheetMode.EditingContent ? (
        <RichText value={unit.content} />
      ) : (
        <>
          <p className="exercise__instructions">Tippe die richtigen Antworten in die Lücken.</p>
          <GapText value={unit.content} exerciseId={unit.id} answer={answer} mode={mode} />
          <ExerciseFeedback entry={feedback} mode={mode} />
        </>
      )}
    </section>
  )
}

function GapText({
  value,
  exerciseId,
  answer,
  mode,
}: {
  value: StoredRichText
  exerciseId: string
  answer: StoredTaggedObject<"fill-in-the-blank", typeof gapAnswerFields> | undefined
  mode: WorksheetMode
}) {
  const { answers } = useWorksheet()
  return (
    <GapInputs
      value={value}
      values={answer?.values.snapshot() ?? {}}
      disabled={mode !== WorksheetMode.Answering}
      onChange={(gapId, text) => {
        if (mode !== WorksheetMode.Answering) return
        const current = answers.get(exerciseId)
        if (current && isTaggedObject(FillInTheGapExercise.answer, current))
          current.values.set(gapId, text)
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
    const fragment = serializeContent(schema, content)
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

export function gradeGap(
  unit: StoredBlock<"fill-in-the-blank", typeof gapUnitFields>,
  answer: StoredTaggedObject<"fill-in-the-blank", typeof gapAnswerFields> | undefined,
): "correct" | "incorrect" | "unassessed" {
  const solutions = new Map<string, string>()
  unit.content.getEditor().state.doc.descendants((node) => {
    if (!node.isText) return
    const id = node.marks.find((mark) => mark.type.name === "gap")?.attrs.id
    if (typeof id === "string") solutions.set(id, (solutions.get(id) ?? "") + node.textContent)
  })
  if (!solutions.size) return "unassessed"
  if (!answer) return "incorrect"
  return [...solutions].every(([id, solution]) => {
    const text = answer.values.get(id)?.get() ?? ""
    return normalize(text) !== "" && normalize(text) === normalize(solution)
  })
    ? "correct"
    : "incorrect"
}

function normalize(text: string) {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase("de")
}
