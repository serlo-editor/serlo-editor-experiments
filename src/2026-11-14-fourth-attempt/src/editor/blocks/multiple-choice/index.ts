import { feedbackFields } from "@editor/blocks/shared/feedback"
import { richText as definition } from "@editor/rich-text"
import { array, boolean, exercise, object, record, richText, string } from "@editor/schema"
import type { StoredBlock, StoredTaggedObject } from "@editor/schema"

import { ChoiceView } from "./view"

const inlineDefinition = definition.inline({ marks: { bold: true, italic: true } })
export const choiceUnitFields = {
  question: richText({ definition: inlineDefinition }),
  options: array(
    object({
      optionId: string(),
      isCorrect: boolean(),
      text: richText({ definition: inlineDefinition }),
    }),
  ),
}
export const choiceAnswerFields = { selected: record(boolean()) }

export const MultipleChoiceExercise = exercise({
  unit: { type: "multiple-choice", fields: choiceUnitFields },
  answer: { fields: choiceAnswerFields },
  feedback: { fields: feedbackFields },
  grade: (unit, answer) => ({
    type: "multiple-choice",
    comment: feedbackFields.comment.defaultValue(),
    result: "automatic",
    automaticResult: gradeChoice(unit, answer),
  }),
  render: ChoiceView,
})

function gradeChoice(
  unit: StoredBlock<"multiple-choice", typeof choiceUnitFields>,
  answer: StoredTaggedObject<"multiple-choice", typeof choiceAnswerFields>,
): "correct" | "incorrect" | "unassessed" {
  const options = unit.options.children()
  if (!options.length) return "unassessed"
  const selected = answer.selected.snapshot()
  return options.every(
    (option) => (selected[option.optionId.get()] ?? false) === option.isCorrect.get(),
  )
    ? "correct"
    : "incorrect"
}
