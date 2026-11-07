import type { RootValue } from "./blocks"
import { gradeGap } from "./blocks/fill-in-the-gap"
import { gradeChoice } from "./blocks/multiple-choice"
import { type Answers, ensureExerciseFeedback, type Feedback } from "./responses"
import type { StoredValueOf } from "./schema/types"

/** Refresh automatic assessments without replacing comments or manual overrides. */
export function gradeExercises(
  content: RootValue,
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
