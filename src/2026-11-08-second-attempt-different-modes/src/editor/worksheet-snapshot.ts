import type { RootSnapshot } from "./blocks"
import type { Answers, Feedback } from "./responses"
import type { SnapshotOf } from "./schema/types"

export interface WorksheetSnapshot {
  content: RootSnapshot
  answers: SnapshotOf<typeof Answers>
  feedback: SnapshotOf<typeof Feedback>
}

export function initialWorksheetSnapshot(content: RootSnapshot): WorksheetSnapshot {
  return {
    content,
    answers: {},
    feedback: { overall: { type: "doc", content: [{ type: "paragraph" }] }, exercises: {} },
  }
}
