import { ReadonlyNodeStore } from "@editor/storage"
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
      const { mode, answers, feedback: feedbackRecord } = useWorksheet()
      if (mode === WorksheetMode.EditingContent) {
        return createElement(render, {
          unit: value,
          mode,
          answer: undefined,
          feedback: undefined,
        })
      }

      if (mode === WorksheetMode.Answering) {
        const answerValue = answers.getOrCreate(value.id, () => answerSchema.defaultValue())
        if (!isTaggedObject(answerSchema, answerValue)) {
          throw new Error("Antwort passt nicht zur Aufgabe.")
        }
        return createElement(render, {
          unit: value,
          mode,
          answer: answerValue,
          feedback: undefined,
        })
      }

      const answerValue = answers.get(value.id)
      if (answerValue !== undefined && !isTaggedObject(answerSchema, answerValue)) {
        throw new Error("Antwort passt nicht zur Aufgabe.")
      }
      const feedbackValue =
        mode === WorksheetMode.GivingFeedback && answerValue !== undefined
          ? feedbackRecord.getOrCreate(
              value.id,
              () => grade(value, answerValue) ?? feedbackSchema.defaultValue(),
            )
          : feedbackRecord.get(value.id)
      if (feedbackValue !== undefined && !isTaggedObject(feedbackSchema, feedbackValue)) {
        throw new Error("Feedback passt nicht zur Aufgabe.")
      }

      return createElement(render, {
        unit: value,
        mode,
        answer:
          answerValue ??
          openRoot(new ReadonlyNodeStore(), answerSchema, answerSchema.defaultValue()),
        feedback:
          feedbackValue ??
          openRoot(new ReadonlyNodeStore(), feedbackSchema, feedbackSchema.defaultValue()),
      })
    },
  })
  return Object.assign(unitBlock, { answer: answerSchema, feedback: feedbackSchema })
}
