import { createElement, useEffect, useReducer, type ReactNode } from "react"

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
      const [, rerender] = useReducer((revision: number) => revision + 1, 0)
      const answerValue = mode === WorksheetMode.EditingContent ? undefined : answers.get(value.id)
      const feedbackValue =
        mode === WorksheetMode.GivingFeedback || mode === WorksheetMode.ViewingFeedback
          ? feedbackRecord.get(value.id)
          : undefined
      const defaultFeedback =
        mode === WorksheetMode.GivingFeedback &&
        feedbackValue === undefined &&
        answerValue !== undefined &&
        isTaggedObject(answerSchema, answerValue)
          ? (grade(value, answerValue) ?? feedbackSchema.defaultValue())
          : undefined

      useEffect(() => {
        if (mode === WorksheetMode.Answering && answers.get(value.id) === undefined) {
          answers.set(value.id, answerSchema.defaultValue())
          rerender()
        }
        if (
          mode === WorksheetMode.GivingFeedback &&
          defaultFeedback !== undefined &&
          feedbackRecord.get(value.id) === undefined
        ) {
          const storedAnswer = answers.get(value.id)
          if (storedAnswer === undefined || !isTaggedObject(answerSchema, storedAnswer)) return
          feedbackRecord.set(value.id, defaultFeedback)
          rerender()
        }
      }, [mode, answers, feedbackRecord, value, defaultFeedback])

      if (answerValue !== undefined && !isTaggedObject(answerSchema, answerValue)) {
        throw new Error("Antwort passt nicht zur Aufgabe.")
      }
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
          answer:
            answerValue ??
            openRoot(new ReadonlyNodeStore(), answerSchema, answerSchema.defaultValue()),
          feedback: undefined,
        })
      }

      if (answerValue === undefined) throw new Error("Antwort fehlt zur Aufgabe.")

      return createElement(render, {
        unit: value,
        mode,
        answer: answerValue,
        feedback:
          feedbackValue ??
          openRoot(
            new ReadonlyNodeStore(),
            feedbackSchema,
            defaultFeedback ?? feedbackSchema.defaultValue(),
          ),
      })
    },
  })
  return Object.assign(unitBlock, { answer: answerSchema, feedback: feedbackSchema })
}
