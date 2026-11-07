import { feedbackText } from "../editor/blocks/shared/feedback"
import type { ResponseDocuments } from "../editor/worksheet"
import { WorksheetMode } from "../editor/worksheet-mode"

/** Run once per mode switch, before binding any peers; current and earlier data stay intact. */
export function clearFollowingDocuments(mode: WorksheetMode, responses: ResponseDocuments) {
  if (mode !== WorksheetMode.EditingContent && mode !== WorksheetMode.Answering) return

  if (mode === WorksheetMode.EditingContent) {
    const answers = responses.answers.document.root
    for (const key of Object.keys(answers.snapshot())) answers.remove(key)
  }

  const feedback = responses.feedback.document.root
  const exercises = feedback.field("exercises")
  for (const key of Object.keys(exercises.snapshot())) exercises.remove(key)
  feedback.field("overall").getEditor().setContent(feedbackText())
}
