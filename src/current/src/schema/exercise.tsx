import { createElement, type ReactNode } from "react"

import { useWorksheet } from "../worksheet-context.ts"
import type { WorksheetMode } from "../worksheet.ts"
import { block, type BlockDefinition, type StoredBlock } from "./block.ts"
import type { SchemaMap } from "./object.ts"
import {
  taggedObject,
  type StoredTaggedObject,
  type TaggedObjectDefinition,
} from "./tagged-object.ts"

/** Independent unit, answer, and feedback schemas linked by unit ID. */
export function exercise<
  const UnitType extends string,
  UnitFields extends SchemaMap,
  AnswerFields extends SchemaMap,
  FeedbackFields extends SchemaMap,
>({
  unit,
  answer,
  feedback,
  render,
}: {
  unit: { type: UnitType; fields: UnitFields & { id?: never; type?: never } }
  answer: { fields: AnswerFields & { id?: never; type?: never } }
  feedback: { fields: FeedbackFields & { id?: never; type?: never } }
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
      if (answerValue !== undefined && !isTaggedObject(answerValue, answerSchema))
        return <p role="alert">Antwort passt nicht zur Aufgabe.</p>
      if (feedbackValue !== undefined && !isTaggedObject(feedbackValue, feedbackSchema))
        return <p role="alert">Feedback passt nicht zur Aufgabe.</p>
      return createElement(render, {
        unit: value,
        answer: answerValue,
        feedback: feedbackValue,
        mode,
      })
    },
  })
  return { unit: unitBlock, answer: answerSchema, feedback: feedbackSchema }
}

function isTaggedObject<Type extends string, Fields extends SchemaMap>(
  value: unknown,
  schema: TaggedObjectDefinition<Type, Fields>,
): value is StoredTaggedObject<Type, Fields> {
  return (
    typeof value === "object" &&
    value !== null &&
    "definition" in value &&
    value.definition === schema
  )
}
