import { createElement, type ReactNode } from "react"

import { useWorksheet } from "../worksheet-context.ts"
import type { WorksheetMode } from "../worksheet.ts"
import { block, type BlockDefinition, type StoredBlock } from "./block.ts"
import type { SchemaMap } from "./object.ts"

/** Independent unit, answer, and feedback schemas linked by unit ID. */
export function exercise<
  const UnitType extends string,
  UnitFields extends SchemaMap,
  const AnswerType extends string,
  AnswerFields extends SchemaMap,
  const FeedbackType extends string,
  FeedbackFields extends SchemaMap,
>({
  unit,
  answer,
  feedback,
  render,
}: {
  unit: { type: UnitType; fields: UnitFields & { id?: never; type?: never } }
  answer: { type: AnswerType; fields: AnswerFields & { id?: never; type?: never } }
  feedback: { type: FeedbackType; fields: FeedbackFields & { id?: never; type?: never } }
  render: (props: {
    unit: StoredBlock<UnitType, UnitFields>
    answer: StoredBlock<AnswerType, AnswerFields> | undefined
    feedback: StoredBlock<FeedbackType, FeedbackFields> | undefined
    mode: WorksheetMode
  }) => ReactNode
}): {
  unit: BlockDefinition<UnitType, UnitFields>
  answer: BlockDefinition<AnswerType, AnswerFields>
  feedback: BlockDefinition<FeedbackType, FeedbackFields>
} {
  const answerBlock = block({ ...answer, render: () => null })
  const feedbackBlock = block({ ...feedback, render: () => null })
  const unitBlock = block({
    ...unit,
    render: function ExerciseView({ value }) {
      const { mode, answers, feedback: feedbackRecord } = useWorksheet()
      const answerValue = answers.get(value.id)
      const feedbackValue = feedbackRecord.get(value.id)
      if (answerValue !== undefined && !isBlock(answerValue, answerBlock))
        return <p role="alert">Antwort passt nicht zur Aufgabe.</p>
      if (feedbackValue !== undefined && !isBlock(feedbackValue, feedbackBlock))
        return <p role="alert">Feedback passt nicht zur Aufgabe.</p>
      return createElement(render, {
        unit: value,
        answer: answerValue,
        feedback: feedbackValue,
        mode,
      })
    },
  })
  return { unit: unitBlock, answer: answerBlock, feedback: feedbackBlock }
}

function isBlock<Type extends string, Fields extends SchemaMap>(
  value: unknown,
  definition: BlockDefinition<Type, Fields>,
): value is StoredBlock<Type, Fields> {
  return (
    typeof value === "object" &&
    value !== null &&
    "definition" in value &&
    value.definition === definition
  )
}
