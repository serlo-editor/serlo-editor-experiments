import { Root } from "./blocks"
import { gradeGap } from "./blocks/fill-in-the-gap"
import { gradeChoice } from "./blocks/multiple-choice"
import { bindReadonlyDocument, type BoundDocument } from "./documents"
import { Answers, ensureExerciseFeedback, Feedback } from "./responses"
import type { StoredValueOf } from "./schema/types"
import { WorksheetMode } from "./worksheet-mode"

export { WorksheetMode } from "./worksheet-mode"

export type ResponseDocuments = {
  answers: BoundDocument<typeof Answers>
  feedback: BoundDocument<typeof Feedback>
}

export type WorksheetDocuments = {
  mode: WorksheetMode
  content: BoundDocument<typeof Root>
  answers?: BoundDocument<typeof Answers>
  feedback?: BoundDocument<typeof Feedback>
}

/** Refresh automatic assessments without replacing comments or manual overrides. */
function gradeExercises(
  content: StoredValueOf<typeof Root>,
  answers: StoredValueOf<typeof Answers>,
  feedback: StoredValueOf<typeof Feedback>,
) {
  for (const exercise of content.children()) {
    if (exercise.type === "text") continue
    const kind = exercise.type === "fill-in-the-blank" ? "gap-feedback" : "choice-feedback"
    const entry = ensureExerciseFeedback(feedback, exercise.id, kind)
    const answer = answers.get(exercise.id)
    const result =
      exercise.type === "fill-in-the-blank"
        ? gradeGap(exercise, answer)
        : gradeChoice(exercise, answer)
    if (entry.field("automaticResult").get() !== result) entry.field("automaticResult").set(result)
  }
}

/** Keep locked documents live through read-only projections of their independent stores. */
export function createModeDocuments(
  mode: WorksheetMode,
  content: BoundDocument<typeof Root>,
  responses: ResponseDocuments,
): WorksheetDocuments {
  if (mode === WorksheetMode.EditingContent) return { mode, content }
  if (mode === WorksheetMode.GivingFeedback) {
    gradeExercises(
      content.document.root,
      responses.answers.document.root,
      responses.feedback.document.root,
    )
  }
  return {
    mode,
    content: bindReadonlyDocument(content, Root),
    answers:
      mode === WorksheetMode.Answering
        ? responses.answers
        : bindReadonlyDocument(responses.answers, Answers),
    feedback:
      mode === WorksheetMode.GivingFeedback
        ? responses.feedback
        : bindReadonlyDocument(responses.feedback, Feedback),
  }
}
