import { boolean, type Schema, type StoredValue, openRoot, record } from "./schema"
import type { StoredRecord } from "./schema/record.ts"
import type { StoredValueOf } from "./schema/types.ts"
import { ReadonlyNodeStore, type NodeKind, type NodeRefs, type NodeStore } from "./storage"
import type { JSONValue } from "./utils"

export enum WorksheetMode {
  EditingContent = "editing-content",
  Answering = "answering",
  GivingFeedback = "giving-feedback",
  ViewingFeedback = "viewing-feedback",
}

export interface Worksheet<Content extends StoredValue> {
  content: Content
  answers: StoredRecord<boolean, StoredValueOf<ReturnType<typeof boolean>>>
  feedback: StoredRecord<boolean, StoredValueOf<ReturnType<typeof boolean>>>
}

export function openWorksheet<
  ContentSnapshot extends JSONValue,
  Content extends StoredValue<ContentSnapshot>,
  ContentKind extends NodeKind,
  Refs extends NodeRefs,
>({
  mode,
  store,
  contentSchema,
  initialSnapshot,
}: {
  mode: WorksheetMode
  store: NodeStore<Refs>
  contentSchema: Schema<ContentSnapshot, Content, ContentKind>
  initialSnapshot: {
    content: ContentSnapshot
    answers: Record<string, boolean>
    feedback: Record<string, boolean>
  }
}): Worksheet<Content> {
  const answersSchema = record(boolean())
  const feedbackSchema = record(boolean())

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
