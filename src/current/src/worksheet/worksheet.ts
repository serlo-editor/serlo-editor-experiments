import {
  type AnySchema,
  type SnapshotOf,
  type StoredRecord,
  type StoredValue,
  type StoredValueOf,
  openRoot,
  type TaggedObjectDefinition,
} from "@editor/schema"
import { ReadonlyNodeStore, type NodeRefs, type NodeStore } from "@editor/storage"

export enum WorksheetMode {
  EditingContent = "editing-content",
  Answering = "answering",
  GivingFeedback = "giving-feedback",
  ViewingFeedback = "viewing-feedback",
}

export interface Worksheet<
  Content extends StoredValue = StoredValue,
  Answers extends StoredRecord<TaggedObjectDefinition<string, {}>> = StoredRecord<
    TaggedObjectDefinition<string, {}>
  >,
  Feedbacks extends StoredRecord<TaggedObjectDefinition<string, {}>> = StoredRecord<
    TaggedObjectDefinition<string, {}>
  >,
> {
  mode: WorksheetMode
  content: Content
  answers: Answers
  feedbacks: Feedbacks
}

export function openWorksheet<
  ContentSchema extends AnySchema,
  AnswersSchema extends AnySchema,
  FeedbacksSchema extends AnySchema,
  Refs extends NodeRefs,
>({
  mode,
  createStore,
  contentSchema,
  answersSchema,
  feedbacksSchema,
  initialSnapshot,
}: {
  mode: WorksheetMode
  createStore: () => NodeStore<Refs>
  contentSchema: ContentSchema
  answersSchema: AnswersSchema
  feedbacksSchema: FeedbacksSchema
  initialSnapshot: {
    content: SnapshotOf<ContentSchema>
    answers: SnapshotOf<AnswersSchema>
    feedback: SnapshotOf<FeedbacksSchema>
  }
}): Worksheet<
  StoredValueOf<ContentSchema>,
  StoredValueOf<AnswersSchema>,
  StoredValueOf<FeedbacksSchema>
> {
  const content =
    mode === WorksheetMode.EditingContent
      ? openRoot(createStore(), contentSchema, initialSnapshot.content)
      : openRoot(new ReadonlyNodeStore(), contentSchema, initialSnapshot.content)
  const answers =
    mode === WorksheetMode.Answering
      ? openRoot(createStore(), answersSchema, initialSnapshot.answers)
      : openRoot(new ReadonlyNodeStore(), answersSchema, initialSnapshot.answers)
  const feedbacks =
    mode === WorksheetMode.GivingFeedback
      ? openRoot(createStore(), feedbacksSchema, initialSnapshot.feedback)
      : openRoot(new ReadonlyNodeStore(), feedbacksSchema, initialSnapshot.feedback)

  return { mode, content, answers, feedbacks }
}
