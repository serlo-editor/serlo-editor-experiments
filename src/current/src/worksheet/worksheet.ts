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
  Feedback extends StoredRecord<TaggedObjectDefinition<string, {}>> = StoredRecord<
    TaggedObjectDefinition<string, {}>
  >,
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
  createStore,
  contentSchema,
  answersSchema,
  feedbackSchema,
  initialSnapshot,
}: {
  mode: WorksheetMode
  createStore: () => NodeStore<Refs>
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
      ? openRoot(createStore(), contentSchema, initialSnapshot.content)
      : openRoot(new ReadonlyNodeStore(), contentSchema, initialSnapshot.content)
  const answers =
    mode === WorksheetMode.Answering
      ? openRoot(createStore(), answersSchema, initialSnapshot.answers)
      : openRoot(new ReadonlyNodeStore(), answersSchema, initialSnapshot.answers)
  const feedback =
    mode === WorksheetMode.GivingFeedback
      ? openRoot(createStore(), feedbackSchema, initialSnapshot.feedback)
      : openRoot(new ReadonlyNodeStore(), feedbackSchema, initialSnapshot.feedback)

  return { mode, content, answers, feedback }
}
