import { type Schema, type StoredValue, openRoot } from "./schema"
import { ReadonlyNodeStore, type NodeKind, type NodeRefs, type NodeStore } from "./storage"
import type { JSONValue } from "./utils"

export enum WorksheetMode {
  EditingContent = "editing-content",
  Answering = "answering",
  GivingFeedback = "giving-feedback",
  ViewingFeedback = "viewing-feedback",
}

export interface Worksheet<
  Content extends StoredValue,
  Answers extends StoredValue,
  Feedback extends StoredValue,
> {
  content: Content
  answers: Answers
  feedback: Feedback
}

export function openWorksheet<
  ContentSnapshot extends JSONValue,
  Content extends StoredValue<ContentSnapshot>,
  ContentKind extends NodeKind,
  AnswersSnapshot extends JSONValue,
  Answers extends StoredValue<AnswersSnapshot>,
  AnswersKind extends NodeKind,
  FeedbackSnapshot extends JSONValue,
  Feedback extends StoredValue<FeedbackSnapshot>,
  FeedbackKind extends NodeKind,
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
  contentSchema: Schema<ContentSnapshot, Content, ContentKind>
  answersSchema: Schema<AnswersSnapshot, Answers, AnswersKind>
  feedbackSchema: Schema<FeedbackSnapshot, Feedback, FeedbackKind>
  initialSnapshot: {
    content: ContentSnapshot
    answers: AnswersSnapshot
    feedback: FeedbackSnapshot
  }
}): Worksheet<Content, Answers, Feedback> {
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

  return { content, answers, feedback }
}
