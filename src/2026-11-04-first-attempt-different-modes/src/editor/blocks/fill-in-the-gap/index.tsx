import { useLayoutEffect, useRef } from "react"

import { ExerciseBadge } from "../../components/ExerciseBadge"
import { RichText } from "../../components/RichText"
import { serializeContent } from "../../components/StaticRichText"
import type { Answers } from "../../responses"
import { richText as definition } from "../../rich-text"
import { exercise, record, richText, string } from "../../schema"
import type { StoredBlock } from "../../schema/block"
import type { StoredRichText } from "../../schema/rich-text"
import type { StoredValueOf } from "../../schema/types"
import { useWorksheet } from "../../worksheet-context"
import { WorksheetMode } from "../../worksheet-mode"
import { ExerciseFeedback, feedbackFields } from "../shared/feedback"

const gapDefinition = definition.block({
  marks: { bold: true, italic: true, gap: true },
  blocks: { paragraph: true },
})
const gapUnitFields = { content: richText({ definition: gapDefinition }) }
const gapAnswerFields = { values: record(string()) }

export const FillInTheGapExercise = exercise({
  unit: { type: "fill-in-the-blank", fields: gapUnitFields },
  answer: { type: "gap-answer", fields: gapAnswerFields },
  feedback: { type: "gap-feedback", fields: feedbackFields },
  render: GapView,
})

function GapView({
  unit,
  answer,
  feedback,
  mode,
}: {
  unit: StoredBlock<"fill-in-the-blank", typeof gapUnitFields>
  answer: StoredBlock<"gap-answer", typeof gapAnswerFields> | undefined
  feedback: StoredBlock<"gap-feedback", typeof feedbackFields> | undefined
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
        <RichText value={unit.field("content")} />
      ) : (
        <>
          <p className="exercise__instructions">Tippe die richtigen Antworten in die Lücken.</p>
          <GapText value={unit.field("content")} exerciseId={unit.id} answer={answer} mode={mode} />
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
  answer: StoredBlock<"gap-answer", typeof gapAnswerFields> | undefined
  mode: WorksheetMode
}) {
  const { answers } = useWorksheet()
  return (
    <GapInputs
      value={value}
      values={answer?.field("values").snapshot() ?? {}}
      disabled={mode !== WorksheetMode.Answering}
      onChange={(gapId, text) => {
        if (mode === WorksheetMode.Answering)
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
  unit: StoredValueOf<typeof FillInTheGapExercise.unit>,
  answer: ReturnType<StoredValueOf<typeof Answers>["get"]>,
): "correct" | "incorrect" | "unassessed" {
  const solutions = new Map<string, string>()
  unit
    .field("content")
    .getEditor()
    .state.doc.descendants((node) => {
      if (!node.isText) return
      const id = node.marks.find((mark) => mark.type.name === "gap")?.attrs.id
      if (typeof id === "string") solutions.set(id, (solutions.get(id) ?? "") + node.textContent)
    })
  if (!solutions.size) return "unassessed"
  if (answer?.type !== "gap-answer") return "incorrect"
  return [...solutions].every(([id, solution]) => {
    const text = answer.field("values").get(id)?.get() ?? ""
    return normalize(text) !== "" && normalize(text) === normalize(solution)
  })
    ? "correct"
    : "incorrect"
}

function normalize(text: string) {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase("de")
}

function setGapAnswer(
  answers: StoredValueOf<typeof Answers>,
  exerciseId: string,
  gapId: string,
  text: string,
) {
  let answer = answers.get(exerciseId)
  if (!answer) {
    answers.set(exerciseId, FillInTheGapExercise.answer.createSnapshot({ values: {} }))
    answer = answers.get(exerciseId)
  }
  if (answer?.type !== "gap-answer") throw new Error("Incompatible answer type.")
  answer.field("values").set(gapId, text)
}
