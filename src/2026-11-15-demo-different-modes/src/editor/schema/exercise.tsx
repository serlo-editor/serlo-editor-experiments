import { useWorksheet, WorksheetMode } from "@editor/worksheet"
import { createElement, type ReactNode } from "react"

import { block, type StoredBlock } from "./block.ts"
import type { ObjectFields } from "./object.ts"
import {
  isTaggedObject,
  taggedObject,
  type StoredTaggedObject,
  type TaggedSnapshot,
} from "./tagged-object.ts"

type ExerciseRenderProps<
  UnitType extends string,
  UnitFields extends ObjectFields,
  AnswerFields extends ObjectFields,
  FeedbackFields extends ObjectFields,
> = { unit: StoredBlock<UnitType, UnitFields> } & (
  | { mode: WorksheetMode.EditingContent; answer: undefined; feedback: undefined }
  | {
      mode: WorksheetMode.Answering
      answer: StoredTaggedObject<UnitType, AnswerFields>
      feedback: undefined
    }
  | {
      mode: WorksheetMode.GivingFeedback | WorksheetMode.ViewingFeedback
      answer: StoredTaggedObject<UnitType, AnswerFields>
      feedback: StoredTaggedObject<UnitType, FeedbackFields>
    }
)

export function exercise<
  const UnitType extends string,
  UnitFields extends ObjectFields,
  AnswerFields extends ObjectFields,
  FeedbackFields extends ObjectFields,
>({
  unit,
  answer,
  feedback,
  grade,
  render,
}: {
  unit: { type: UnitType; fields: UnitFields }
  answer: { fields: AnswerFields }
  feedback: { fields: FeedbackFields }
  /** Initializes missing feedback when giving feedback; undefined uses the schema default. */
  grade: (
    unit: StoredBlock<UnitType, UnitFields>,
    answer: StoredTaggedObject<UnitType, AnswerFields>,
  ) => TaggedSnapshot<UnitType, FeedbackFields> | null
  render: (
    props: ExerciseRenderProps<UnitType, UnitFields, AnswerFields, FeedbackFields>,
  ) => ReactNode
}) {
  const answerSchema = taggedObject({ ...answer, type: unit.type })
  const feedbackSchema = taggedObject({ ...feedback, type: unit.type })
  const unitBlock = block({
    ...unit,
    render: function ExerciseView({ value }) {
      const { mode, answers, feedbacks } = useWorksheet()

      if (mode === WorksheetMode.EditingContent) {
        return createElement(render, { unit: value, mode, answer: undefined, feedback: undefined })
      }

      const answer = answers.getOrCreate(value.id, () => answerSchema.defaultValue())
      if (!isTaggedObject(answerSchema, answer)) {
        throw new Error("Antwort passt nicht zur Aufgabe.")
      }

      if (mode === WorksheetMode.Answering) {
        return createElement(render, { unit: value, mode, answer, feedback: undefined })
      }

      const feedback = feedbacks.getOrCreate(
        value.id,
        () => grade(value, answer) ?? feedbackSchema.defaultValue(),
      )
      if (!isTaggedObject(feedbackSchema, feedback)) {
        throw new Error("Feedback passt nicht zur Aufgabe.")
      }

      return createElement(render, { unit: value, mode, answer, feedback })
    },
  })
  return Object.assign(unitBlock, { answer: answerSchema, feedback: feedbackSchema })
}
