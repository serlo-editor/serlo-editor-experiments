import { createElement, type ReactNode } from "react"

import { ReadonlyNodeStore } from "../storage/index.ts"
import { useWorksheet } from "../worksheet-context.ts"
import { WorksheetMode } from "../worksheet.ts"
import { block, type BlockFields, type StoredBlock } from "./block.ts"
import { openRoot } from "./root.ts"
import {
  isTaggedObject,
  taggedObject,
  type StoredTaggedObject,
  type TaggedFields,
  type TaggedSnapshot,
} from "./tagged-object.ts"

type ExerciseRenderProps<
  UnitType extends string,
  UnitFields extends BlockFields,
  AnswerFields extends TaggedFields,
  FeedbackFields extends TaggedFields,
> = {
  unit: StoredBlock<UnitType, UnitFields>
} & (
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
  UnitFields extends BlockFields,
  AnswerFields extends TaggedFields,
  FeedbackFields extends TaggedFields,
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
      const { mode, answers, feedback: feedbackRecord } = useWorksheet()
      const answerValue =
        mode === WorksheetMode.EditingContent
          ? undefined
          : mode === WorksheetMode.Answering
            ? answers.getOrCreate(value.id, () => answerSchema.defaultValue())
            : answers.get(value.id)
      if (answerValue !== undefined && !isTaggedObject(answerSchema, answerValue)) {
        throw new Error("Antwort passt nicht zur Aufgabe.")
      }

      // Skipping answering still renders and grades an unanswered exercise.
      const emptyAnswer = () =>
        openRoot(new ReadonlyNodeStore(), answerSchema, answerSchema.defaultValue())
      const feedbackValue =
        mode === WorksheetMode.GivingFeedback
          ? feedbackRecord.getOrCreate(
              value.id,
              () => grade(value, answerValue ?? emptyAnswer()) ?? feedbackSchema.defaultValue(),
            )
          : mode === WorksheetMode.ViewingFeedback
            ? feedbackRecord.get(value.id)
            : undefined
      if (feedbackValue !== undefined && !isTaggedObject(feedbackSchema, feedbackValue)) {
        throw new Error("Feedback passt nicht zur Aufgabe.")
      }

      if (mode === WorksheetMode.EditingContent) {
        return createElement(render, {
          unit: value,
          mode,
          answer: undefined,
          feedback: undefined,
        })
      }

      if (mode === WorksheetMode.Answering) {
        return createElement(render, {
          unit: value,
          mode,
          answer: answerValue ?? emptyAnswer(),
          feedback: undefined,
        })
      }

      return createElement(render, {
        unit: value,
        mode,
        answer: answerValue ?? emptyAnswer(),
        feedback:
          feedbackValue ??
          openRoot(new ReadonlyNodeStore(), feedbackSchema, feedbackSchema.defaultValue()),
      })
    },
  })
  return Object.assign(unitBlock, { answer: answerSchema, feedback: feedbackSchema })
}
