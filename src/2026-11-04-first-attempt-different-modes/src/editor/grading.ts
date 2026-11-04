import type { FillInTheBlank, MultipleChoice, RootValue } from "./content"
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
    const result = gradeExercise(exercise, answers.get(exercise.id))
    if (entry.field("automaticResult").get() !== result) entry.field("automaticResult").set(result)
  }
}

function gradeExercise(
  exercise: StoredValueOf<typeof FillInTheBlank> | StoredValueOf<typeof MultipleChoice>,
  answer: ReturnType<StoredValueOf<typeof Answers>["get"]>,
): "correct" | "incorrect" | "unassessed" {
  if (exercise.type === "multiple-choice") {
    const options = exercise.field("options").children()
    if (!options.length) return "unassessed"
    if (answer?.type !== "choice-answer") return "incorrect"
    return options.every(
      (option) =>
        (answer.field("selected").get(option.field("optionId").get())?.get() ?? false) ===
        option.field("isCorrect").get(),
    )
      ? "correct"
      : "incorrect"
  }
  const solutions = new Map<string, string>()
  exercise
    .field("content")
    .getEditor()
    .state.doc.descendants((node) => {
      if (!node.isText) return
      const id = node.marks.find((mark) => mark.type.name === "gap")?.attrs.id
      if (typeof id === "string") solutions.set(id, (solutions.get(id) ?? "") + node.textContent)
    })
  if (!solutions.size) return "unassessed"
  if (answer?.type !== "gap-answer") return "incorrect"
  return [...solutions].every(([id, solution]) => {
    const text = answer.field("values").get(id)?.get() ?? ""
    return normalize(text) !== "" && normalize(text) === normalize(solution)
  })
    ? "correct"
    : "incorrect"
}

function normalize(text: string) {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase("de")
}
