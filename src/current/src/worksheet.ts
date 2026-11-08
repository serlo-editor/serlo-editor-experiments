import { type StoredValue, openRoot } from "./schema"
import type { StoredRecord } from "./schema/record.ts"
import type { TaggedObjectDefinition } from "./schema/tagged-object.ts"
import type { AnySchema, SnapshotOf, StoredValueOf } from "./schema/types.ts"
import { ReadonlyNodeStore, type NodeRefs, type NodeStore } from "./storage"

export enum WorksheetMode {
  EditingContent = "editing-content",
  Answering = "answering",
  GivingFeedback = "giving-feedback",
  ViewingFeedback = "viewing-feedback",
}

export interface Worksheet<
  Content extends StoredValue = StoredValue,
  Answers extends StoredRecord<TaggedObjectDefinition> = StoredRecord<TaggedObjectDefinition>,
  Feedback extends StoredRecord<TaggedObjectDefinition> = StoredRecord<TaggedObjectDefinition>,
> {
  mode: WorksheetMode
  content: Content
  answers: Answers
  feedback: Feedback
}

export function openWorksheet<
  ContentSchema extends AnySchema,
  AnswersSchema extends AnySchema,
  FeedbackSchema extends AnySchema,
  Refs extends NodeRefs,
>({
  mode,
  store,
  contentSchema,
  answersSchema,
  feedbackSchema,
  initialSnapshot,
}: {
  mode: WorksheetMode
  store: NodeStore<Refs>
  contentSchema: ContentSchema
  answersSchema: AnswersSchema
  feedbackSchema: FeedbackSchema
  initialSnapshot: {
    content: SnapshotOf<ContentSchema>
    answers: SnapshotOf<AnswersSchema>
    feedback: SnapshotOf<FeedbackSchema>
  }
}): Worksheet<
  StoredValueOf<ContentSchema>,
  StoredValueOf<AnswersSchema>,
  StoredValueOf<FeedbackSchema>
> {
  const content =
    mode === WorksheetMode.EditingContent
      ? openRoot(store, contentSchema, initialSnapshot.content)
      : openRoot(new ReadonlyNodeStore(), contentSchema, initialSnapshot.content)

  const answers =
    mode === WorksheetMode.Answering
      ? openRoot(store, answersSchema, initialSnapshot.answers)
      : openRoot(new ReadonlyNodeStore(), answersSchema, initialSnapshot.answers)

  const feedback =
    mode === WorksheetMode.GivingFeedback
      ? openRoot(store, feedbackSchema, initialSnapshot.feedback)
      : openRoot(new ReadonlyNodeStore(), feedbackSchema, initialSnapshot.feedback)

  return { mode, content, answers, feedback }
}
