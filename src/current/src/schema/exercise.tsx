import { createElement, type ReactNode } from "react"

import { useWorksheet } from "../worksheet-context.ts"
import type { WorksheetMode } from "../worksheet.ts"
import { block, type BlockFields, type StoredBlock } from "./block.ts"
import {
  isTaggedObject,
  taggedObject,
  type StoredTaggedObject,
  type TaggedFields,
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
    mode: WorksheetMode
    unit: StoredBlock<UnitType, UnitFields>
    answer: StoredTaggedObject<UnitType, AnswerFields> | undefined
    feedback: StoredTaggedObject<UnitType, FeedbackFields> | undefined
  }) => ReactNode
}) {
  const answerSchema = taggedObject({ ...answer, type: unit.type })
  const feedbackSchema = taggedObject({ ...feedback, type: unit.type })
  const unitBlock = block({
    ...unit,
    render: function ExerciseView({ value }) {
      const { mode, answers, feedback: feedbackRecord } = useWorksheet()

      const answerValue = answers.get(value.id)
      if (answerValue !== undefined && !isTaggedObject(answerSchema, answerValue)) {
        throw new Error("Antwort passt nicht zur Aufgabe.")
      }

      const feedbackValue = feedbackRecord.get(value.id)
      if (feedbackValue !== undefined && !isTaggedObject(feedbackSchema, feedbackValue)) {
        throw new Error("Feedback passt nicht zur Aufgabe.")
      }

      return createElement(render, {
        unit: value,
        answer: answerValue,
        feedback: feedbackValue,
        mode,
      })
    },
  })
  return Object.assign(unitBlock, { answer: answerSchema, feedback: feedbackSchema })
}
