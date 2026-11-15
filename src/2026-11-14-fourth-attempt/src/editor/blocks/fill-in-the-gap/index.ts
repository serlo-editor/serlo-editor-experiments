import { feedbackFields } from "@editor/blocks/shared/feedback"
import { richText as definition } from "@editor/rich-text"
import { exercise, record, richText, string } from "@editor/schema"
import type { StoredBlock, StoredTaggedObject } from "@editor/schema"

import { GapView } from "./view"

const gapDefinition = definition.block({
  marks: { bold: true, italic: true, gap: true },
  blocks: { paragraph: true },
})
export const gapUnitFields = { content: richText({ definition: gapDefinition }) }
export const gapAnswerFields = { values: record(string()) }

export const FillInTheGapExercise = exercise({
  unit: { type: "fill-in-the-blank", fields: gapUnitFields },
  answer: { fields: gapAnswerFields },
  feedback: { fields: feedbackFields },
  grade: (unit, answer) => ({
    type: "fill-in-the-blank",
    comment: feedbackFields.comment.defaultValue(),
    result: "automatic",
    automaticResult: gradeGap(unit, answer),
  }),
  render: GapView,
})

function gradeGap(
  unit: StoredBlock<"fill-in-the-blank", typeof gapUnitFields>,
  answer: StoredTaggedObject<"fill-in-the-blank", typeof gapAnswerFields>,
): "correct" | "incorrect" | "unassessed" {
  const solutions = new Map<string, string>()
  unit.content.getEditor().state.doc.descendants((node) => {
    if (!node.isText) return
    const id = node.marks.find((mark) => mark.type.name === "gap")?.attrs.id
    if (typeof id === "string") solutions.set(id, (solutions.get(id) ?? "") + node.textContent)
  })
  if (!solutions.size) return "unassessed"
  const values = answer.values.snapshot()
  return [...solutions].every(([id, solution]) => {
    const text = values[id] ?? ""
    return normalize(text) !== "" && normalize(text) === normalize(solution)
  })
    ? "correct"
    : "incorrect"
}

function normalize(text: string) {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase("de")
}
