import { object } from "./schema/object.ts"
import type { ObjectSnapshot, SchemaMap, StoredObject } from "./schema/object.ts"
import { openRoot } from "./schema/root.ts"
import type { Schema, StoredValue } from "./schema/types.ts"
import type { NodeKind, NodeRefs, NodeStore } from "./storage/index.ts"
import type { JSONValue } from "./utils/index.ts"

export enum WorksheetMode {
  EditingContent = "editing-content",
  Answering = "answering",
  GivingFeedback = "giving-feedback",
  ViewingFeedback = "viewing-feedback",
}

export function openWorksheet<
  ContentSnapshot extends JSONValue,
  Content extends StoredValue<ContentSnapshot>,
  ContentKind extends NodeKind,
  AnswerSchemas extends SchemaMap,
  FeedbackSchemas extends SchemaMap,
  RefsWritable extends NodeRefs,
  RefsReadonly extends NodeRefs,
>({
  mode,
  writableStore,
  readonlyStore,
  schema,
  initialSnapshot,
}: {
  mode: WorksheetMode
  writableStore: NodeStore<RefsWritable>
  readonlyStore: NodeStore<RefsReadonly>
  schema: {
    content: Schema<ContentSnapshot, Content, ContentKind>
    answers: AnswerSchemas
    feedback: FeedbackSchemas
  }
  initialSnapshot: {
    content: ContentSnapshot
    answers: ObjectSnapshot<AnswerSchemas>
    feedback: ObjectSnapshot<FeedbackSchemas>
  }
}): {
  content: Content
  answers: StoredObject<AnswerSchemas>
  feedback: StoredObject<FeedbackSchemas>
} {
  const worksheetSchema = object({
    content: schema.content,
    answers: object(schema.answers),
    feedback: object(schema.feedback),
  })
  const writable = openRoot(writableStore, worksheetSchema, initialSnapshot)
  const readonly = openRoot(readonlyStore, worksheetSchema, initialSnapshot)

  return {
    content: (mode === WorksheetMode.EditingContent ? writable : readonly).field("content"),
    answers: (mode === WorksheetMode.Answering ? writable : readonly).field("answers"),
    feedback: (mode === WorksheetMode.GivingFeedback ? writable : readonly).field("feedback"),
  }
}
