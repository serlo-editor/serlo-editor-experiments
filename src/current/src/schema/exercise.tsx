import { createElement, type ReactNode } from "react"

import { useWorksheet } from "../worksheet-context.ts"
import type { WorksheetMode } from "../worksheet.ts"
import { block, type BlockDefinition, type BlockFields, type StoredBlock } from "./block.ts"
import {
  taggedObject,
  type StoredTaggedObject,
  type TaggedFields,
  type TaggedObjectDefinition,
} from "./tagged-object.ts"

/** Independent unit, answer, and feedback schemas linked by unit ID. */
export function exercise<
  const UnitType extends string,
  UnitFields extends BlockFields,
  AnswerFields extends TaggedFields,
  FeedbackFields extends TaggedFields,
>({
  unit,
  answer,
  feedback,
  render,
}: {
  unit: { type: UnitType; fields: UnitFields }
  answer: { fields: AnswerFields }
  feedback: { fields: FeedbackFields }
  render: (props: {
    unit: StoredBlock<UnitType, UnitFields>
    answer: StoredTaggedObject<UnitType, AnswerFields> | undefined
    feedback: StoredTaggedObject<UnitType, FeedbackFields> | undefined
    mode: WorksheetMode
  }) => ReactNode
}): {
  unit: BlockDefinition<UnitType, UnitFields>
  answer: TaggedObjectDefinition<UnitType, AnswerFields>
  feedback: TaggedObjectDefinition<UnitType, FeedbackFields>
} {
  const answerSchema = taggedObject({ ...answer, type: unit.type })
  const feedbackSchema = taggedObject({ ...feedback, type: unit.type })
  const unitBlock = block({
    ...unit,
    render: function ExerciseView({ value }) {
      const { mode, answers, feedback: feedbackRecord } = useWorksheet()
      const answerValue = answers.get(value.id)
      const feedbackValue = feedbackRecord.get(value.id)
      return createElement(render, {
        unit: value,
        answer: answerValue as StoredTaggedObject<UnitType, AnswerFields> | undefined,
        feedback: feedbackValue as StoredTaggedObject<UnitType, FeedbackFields> | undefined,
        mode,
      })
    },
  })
  return { unit: unitBlock, answer: answerSchema, feedback: feedbackSchema }
}
