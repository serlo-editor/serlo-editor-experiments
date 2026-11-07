import * as Y from "yjs"

import { Root, type RootSnapshot } from "../editor/content"
import { Answers, Feedback, feedbackText } from "../editor/responses"
import type { Schema, StoredValue } from "../editor/schema/types"
import { createDocumentSession } from "../editor/session"
import type { NodeKind } from "../editor/storage"
import type { JSONValue } from "../editor/utils"
import { syncCDRTs } from "./sync-cdrts"

export function createDemoSessions(snapshot: RootSnapshot) {
  const content = createSessionPair(Root, snapshot)
  const cleanups = [content.destroy]
  const destroy = () => {
    for (const cleanup of cleanups) cleanup()
  }
  try {
    const answers = createSessionPair(Answers, {})
    cleanups.push(answers.destroy)
    const feedback = createSessionPair(Feedback, { overall: feedbackText(), exercises: {} })
    cleanups.push(feedback.destroy)
    return {
      first: content.first,
      second: content.second,
      responses: { answers: answers.first, feedback: feedback.first },
      secondResponses: { answers: answers.second, feedback: feedback.second },
      destroy,
    }
  } catch (error) {
    destroy()
    throw error
  }
}

function createSessionPair<
  Snapshot extends JSONValue,
  Value extends StoredValue<Snapshot>,
  Kind extends NodeKind,
>(schema: Schema<Snapshot, Value, Kind>, snapshot: Snapshot) {
  const first = createDocumentSession({ name: "Editor 1", color: "#2563eb" }, schema, snapshot)
  try {
    const second = createDocumentSession(
      { name: "Editor 2", color: "#b45309" },
      schema,
      snapshot,
      Y.encodeStateAsUpdate(first.doc),
    )
    const disconnect = syncCDRTs(first, second)
    return {
      first,
      second,
      destroy() {
        disconnect()
        first.destroy()
        second.destroy()
      },
    }
  } catch (error) {
    first.destroy()
    throw error
  }
}
