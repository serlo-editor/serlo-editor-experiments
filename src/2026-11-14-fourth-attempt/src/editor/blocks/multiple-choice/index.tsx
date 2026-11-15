import { ExerciseBadge } from "@editor/blocks/shared/ExerciseBadge"
import { ExerciseFeedback, feedbackFields } from "@editor/blocks/shared/feedback"
import { RichText, StaticRichText } from "@editor/components"
import { richText as definition } from "@editor/rich-text"
import { array, boolean, exercise, object, record, richText, string } from "@editor/schema"
import type { StoredBlock, StoredTaggedObject } from "@editor/schema"
import { WorksheetMode } from "@editor/worksheet"

import styles from "./index.module.css"

const inlineDefinition = definition.inline({ marks: { bold: true, italic: true } })
const choiceUnitFields = {
  question: richText({ definition: inlineDefinition }),
  options: array(
    object({
      optionId: string(),
      isCorrect: boolean(),
      text: richText({ definition: inlineDefinition }),
    }),
  ),
}
const choiceAnswerFields = { selected: record(boolean()) }

export const MultipleChoiceExercise = exercise({
  unit: { type: "multiple-choice", fields: choiceUnitFields },
  answer: { fields: choiceAnswerFields },
  feedback: { fields: feedbackFields },
  grade: (unit, answer) => ({
    type: "multiple-choice",
    comment: feedbackFields.comment.defaultValue(),
    result: "automatic",
    automaticResult: gradeChoice(unit, answer),
  }),
  render: ChoiceView,
})

function ChoiceView({
  unit,
  answer,
  feedback,
  mode,
}: {
  unit: StoredBlock<"multiple-choice", typeof choiceUnitFields>
  answer: StoredTaggedObject<"multiple-choice", typeof choiceAnswerFields> | undefined
  feedback: StoredTaggedObject<"multiple-choice", typeof feedbackFields> | undefined
  mode: WorksheetMode
}) {
  return (
    <section className={styles.exercise} aria-label="Multiple Choice">
      <ExerciseBadge label="Multiple Choice" help="Mehrere Antworten können richtig sein." />
      {mode === WorksheetMode.EditingContent ? (
        <>
          <h3 className={styles.fieldLabel}>Aufgabenstellung</h3>
          <div className={`${styles.answerInput} ${styles.question}`}>
            <RichText value={unit.question} inline />
          </div>
          <h3 className={styles.fieldLabel}>Antworten</h3>
          <ul className={styles.options}>
            {unit.options.map((option) => (
              <li key={option.optionId.get()}>
                <div className={styles.answerInput}>
                  <RichText value={option.text} inline />
                </div>
                <label
                  className={
                    option.isCorrect.get()
                      ? `${styles.correctness} ${styles.correct}`
                      : styles.correctness
                  }
                >
                  <input
                    type="checkbox"
                    checked={option.isCorrect.get()}
                    onChange={(event) => option.isCorrect.set(event.currentTarget.checked)}
                  />
                  {option.isCorrect.get() ? "Richtig" : "Falsch"}
                </label>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <div className={styles.prompt}>
            <StaticRichText value={unit.question} inline />
          </div>
          <div className={styles.choiceOptions}>
            {unit.options.map((option) => {
              const optionId = option.optionId.get()
              return (
                <label key={optionId} className={styles.choiceCard}>
                  <StaticRichText value={option.text} inline />
                  <input
                    type="checkbox"
                    checked={answer?.selected.snapshot()[optionId] ?? false}
                    disabled={mode !== WorksheetMode.Answering}
                    onChange={(event) => {
                      if (mode === WorksheetMode.Answering)
                        answer?.selected.set(optionId, event.currentTarget.checked)
                    }}
                  />
                </label>
              )
            })}
          </div>
          <ExerciseFeedback entry={feedback} mode={mode} />
        </>
      )}
    </section>
  )
}

function gradeChoice(
  unit: StoredBlock<"multiple-choice", typeof choiceUnitFields>,
  answer: StoredTaggedObject<"multiple-choice", typeof choiceAnswerFields>,
): "correct" | "incorrect" | "unassessed" {
  const options = unit.options.children()
  if (!options.length) return "unassessed"
  const selected = answer.selected.snapshot()
  return options.every(
    (option) => (selected[option.optionId.get()] ?? false) === option.isCorrect.get(),
  )
    ? "correct"
    : "incorrect"
}
