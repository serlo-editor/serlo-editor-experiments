import { ChoiceView, GapView } from "../components/ExerciseViews"
import { richText as definition } from "../rich-text"
import { array, boolean, exercise, object, record, richText, string } from "../schema"

const gapDefinition = definition.block({
  marks: { bold: true, italic: true, gap: true },
  blocks: { paragraph: true },
})
const comment = richText({
  definition: definition.block({
    marks: { bold: true, italic: true },
    blocks: { paragraph: true, orderedList: true, bulletList: true },
  }),
})
export const feedbackFields = { comment, result: string(), automaticResult: string() }
export const gapUnitFields = { content: richText({ definition: gapDefinition }) }
export const gapAnswerFields = { values: record(string()) }

export const FillInTheGapExercise = exercise({
  unit: { type: "fill-in-the-blank", fields: gapUnitFields },
  answer: { type: "gap-answer", fields: gapAnswerFields },
  feedback: { type: "gap-feedback", fields: feedbackFields },
  render: GapView,
})

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
  answer: { type: "choice-answer", fields: choiceAnswerFields },
  feedback: { type: "choice-feedback", fields: feedbackFields },
  render: ChoiceView,
})
