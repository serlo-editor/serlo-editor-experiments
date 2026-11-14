import { richText as definition } from "@editor/rich-text"
import { array, boolean, exercise, object, record, richText, string } from "@editor/schema"
import type { StoredBlock } from "@editor/schema"
import type { StoredTaggedObject } from "@editor/schema/tagged-object"
import { WorksheetMode } from "@editor/worksheet"

import { ExerciseBadge } from "../../components/ExerciseBadge"
import { RichText } from "../../components/RichText"
import { StaticRichText } from "../../components/StaticRichText"
import { ExerciseFeedback, feedbackFields, feedbackText } from "../shared/feedback"

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
    comment: feedbackText(),
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
    <section className="exercise exercise--multiple-choice">
      <ExerciseBadge label="Multiple Choice" help="Mehrere Antworten können richtig sein." />
      {mode === WorksheetMode.EditingContent ? (
        <>
          <h3 className="exercise__field-label">Aufgabenstellung</h3>
          <div className="answer-input exercise__question">
            <RichText value={unit.question} inline />
          </div>
          <h3 className="exercise__field-label">Antworten</h3>
          <ul className="multiple-choice-options">
            {unit.options.map((option) => (
              <li key={option.optionId.get()}>
                <div className="answer-input">
                  <RichText value={option.text} inline />
                </div>
                <label
                  className={
                    option.isCorrect.get() ? "correctness correctness--correct" : "correctness"
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
          <div className="exercise__prompt">
            <StaticRichText value={unit.question} inline />
          </div>
          <div className="choice-options">
            {unit.options.map((option) => {
              const optionId = option.optionId.get()
              return (
                <label key={optionId} className="choice-card">
                  <StaticRichText value={option.text} inline />
                  <input
                    type="checkbox"
                    checked={answer?.selected.get(optionId)?.get() ?? false}
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
  return options.every(
    (option) =>
      (answer.selected.get(option.optionId.get())?.get() ?? false) === option.isCorrect.get(),
  )
    ? "correct"
    : "incorrect"
}
