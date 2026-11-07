import { Root } from "./blocks"
import { feedbackText } from "./blocks/shared/feedback"
import { bindReadonlyDocument, type BoundDocument } from "./documents"
import { gradeExercises } from "./grading"
import { Answers, Feedback } from "./responses"
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
