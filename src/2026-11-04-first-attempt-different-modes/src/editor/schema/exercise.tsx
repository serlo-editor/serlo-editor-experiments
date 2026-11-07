import { createElement, type ReactNode } from "react"

import { WorksheetMode } from "../worksheet"
import { useWorksheet } from "../worksheet-context"
import { block, type BlockDefinition, type StoredBlock } from "./block"
import type { SchemaMap } from "./object"

/** Three independent block schemas, joined by unit ID only while rendering. */
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
      const { mode, answers, feedback: feedbackDocument } = useWorksheet()
      const answerValue = answers?.document.root.get(value.id)
      const feedbackValue = feedbackDocument?.document.root.field("exercises").get(value.id)
      if (answerValue && answerValue.type !== answer.type)
        return <p role="alert">Antwort passt nicht zur Aufgabe.</p>
      if (feedbackValue && feedbackValue.type !== feedback.type)
        return <p role="alert">Feedback passt nicht zur Aufgabe.</p>
      // Type checks above validate the discriminator; response records hold a union of schemas.
      return createElement(render, {
        unit: value,
        answer: answerValue as StoredBlock<AnswerType, AnswerFields> | undefined,
        feedback: feedbackValue as StoredBlock<FeedbackType, FeedbackFields> | undefined,
        mode,
      })
    },
  })
  return { unit: unitBlock, answer: answerBlock, feedback: feedbackBlock }
}
