import type { StoredValue, Schema } from "./schema"
import { openRoot } from "./schema/root"
import type { NodeKind, NodeRefs, NodeStore } from "./storage"
import type { JSONValue } from "./utils"

export enum WorksheetMode {
  EditingContent = "editing-content",
  Answering = "answering",
  GivingFeedback = "giving-feedback",
  ViewingFeedback = "viewing-feedback",
}

export function openWorksheet<
  Snapshot extends JSONValue,
  Root extends StoredValue<Snapshot>,
  Kind extends NodeKind,
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
  schema: Schema<Snapshot, Root, Kind>
  initialSnapshot: Snapshot
}) {
  const content =
    mode === WorksheetMode.EditingContent
      ? openRoot(writableStore, schema, initialSnapshot)
      : openRoot(readonlyStore, schema, initialSnapshot)

  const answers =
    mode === WorksheetMode.Answering ? openRoot(writableStore, schema, initialSnapshot) : undefined

  const feedback =
    mode === WorksheetMode.GivingFeedback || mode === WorksheetMode.ViewingFeedback
      ? openRoot(writableStore, schema, initialSnapshot)
      : undefined

  return {
    content,
    answers,
    feedback,
  }
}
