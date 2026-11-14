import { ReadonlyNodeStore } from "@editor/store"
import { useWorksheet, WorksheetMode } from "@editor/worksheet"
import { createElement, type ReactNode } from "react"

import { block, type StoredBlock } from "./block.ts"
import type { ObjectFields } from "./object.ts"
import { openRoot } from "./root.ts"
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

      const savedAnswer =
        mode === WorksheetMode.Answering
          ? answers.getOrCreate(value.id, () => answerSchema.defaultValue())
          : answers.get(value.id)
      if (savedAnswer && !isTaggedObject(answerSchema, savedAnswer)) {
        throw new Error("Antwort passt nicht zur Aufgabe.")
      }

      if (mode === WorksheetMode.Answering) {
        return createElement(render, {
          unit: value,
          mode,
          answer:
            savedAnswer ??
            openRoot(new ReadonlyNodeStore(), answerSchema, answerSchema.defaultValue()),
          feedback: undefined,
        })
      }

      // Missing answers are read-only defaults; grading must not create an answer.
      const answer =
        savedAnswer ?? openRoot(new ReadonlyNodeStore(), answerSchema, answerSchema.defaultValue())
      const savedFeedback =
        mode === WorksheetMode.GivingFeedback
          ? feedbacks.getOrCreate(
              value.id,
              () => grade(value, answer) ?? feedbackSchema.defaultValue(),
            )
          : feedbacks.get(value.id)
      if (savedFeedback && !isTaggedObject(feedbackSchema, savedFeedback)) {
        throw new Error("Feedback passt nicht zur Aufgabe.")
      }
      const feedback =
        savedFeedback ??
        openRoot(new ReadonlyNodeStore(), feedbackSchema, feedbackSchema.defaultValue())
      return createElement(render, { unit: value, mode, answer, feedback })
    },
  })
  return Object.assign(unitBlock, { answer: answerSchema, feedback: feedbackSchema })
}
