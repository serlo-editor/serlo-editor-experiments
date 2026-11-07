import { Root } from "./blocks"
import { gradeGap } from "./blocks/fill-in-the-gap"
import { gradeChoice } from "./blocks/multiple-choice"
import { feedbackText } from "./blocks/shared/feedback"
import { readOnlyDocument, type BoundDocument } from "./documents"
import { Answers, ensureExerciseFeedback, Feedback } from "./responses"
import { WorksheetMode } from "./worksheet-mode"

export { WorksheetMode } from "./worksheet-mode"

/** Three independent source documents belonging to one peer. */
export type WorksheetSources = {
  content: BoundDocument<typeof Root>
  answers: BoundDocument<typeof Answers>
  feedback: BoundDocument<typeof Feedback>
}

export type Worksheet = WorksheetSources & { mode: WorksheetMode }

/** Run once per actual mode switch on one peer; Yjs synchronizes changes to the other. */
export function prepareWorksheetMode(
  previous: WorksheetMode,
  next: WorksheetMode,
  worksheet: WorksheetSources,
) {
  if (previous === next) return
  clearFollowingDocuments(next, worksheet)
  if (next === WorksheetMode.GivingFeedback) gradeExercises(worksheet)
}

/** Expose writable document only for current mode; other documents stay live and immutable. */
export function createWorksheet(mode: WorksheetMode, worksheet: WorksheetSources): Worksheet {
  return {
    mode,
    content:
      mode === WorksheetMode.EditingContent
        ? worksheet.content
        : readOnlyDocument(worksheet.content, Root),
    answers:
      mode === WorksheetMode.Answering
        ? worksheet.answers
        : readOnlyDocument(worksheet.answers, Answers),
    feedback:
      mode === WorksheetMode.GivingFeedback
        ? worksheet.feedback
        : readOnlyDocument(worksheet.feedback, Feedback),
  }
}

function clearFollowingDocuments(mode: WorksheetMode, worksheet: WorksheetSources) {
  if (mode !== WorksheetMode.EditingContent && mode !== WorksheetMode.Answering) return

  if (mode === WorksheetMode.EditingContent) {
    const answers = worksheet.answers.document.root
    for (const key of Object.keys(answers.snapshot())) answers.remove(key)
  }

  const feedback = worksheet.feedback.document.root
  const exercises = feedback.field("exercises")
  for (const key of Object.keys(exercises.snapshot())) exercises.remove(key)
  feedback.field("overall").getEditor().setContent(feedbackText())
}

/** Refresh automatic assessments without replacing comments or manual overrides. */
function gradeExercises(worksheet: WorksheetSources) {
  const content = worksheet.content.document.root
  const answers = worksheet.answers.document.root
  const feedback = worksheet.feedback.document.root
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
