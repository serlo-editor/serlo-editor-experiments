import { ExerciseBadge } from "../../components/ExerciseBadge"
import { RichText } from "../../components/RichText"
import { StaticRichText } from "../../components/StaticRichText"
import { richText as definition } from "../../rich-text"
import {
  array,
  boolean,
  exercise,
  isTaggedObject,
  object,
  record,
  richText,
  string,
} from "../../schema"
import type { StoredBlock } from "../../schema/block"
import type { StoredTaggedObject } from "../../schema/tagged-object"
import { WorksheetMode } from "../../worksheet"
import { useWorksheet } from "../../worksheet-context"
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
    type: unit.type,
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
  const { answers } = useWorksheet()
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
            {unit.options.map((option) => {
              const correctness = option.isCorrect
              return (
                <li key={option.optionId.get()}>
                  <div className="answer-input">
                    <RichText value={option.text} inline />
                  </div>
                  <label
                    className={
                      correctness.get() ? "correctness correctness--correct" : "correctness"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={correctness.get()}
                      onChange={(event) => correctness.set(event.currentTarget.checked)}
                    />
                    {correctness.get() ? "Richtig" : "Falsch"}
                  </label>
                </li>
              )
            })}
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
                      if (mode !== WorksheetMode.Answering) return
                      const current = answers.get(unit.id)
                      if (current && isTaggedObject(MultipleChoiceExercise.answer, current))
                        current.selected.set(optionId, event.currentTarget.checked)
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

export function gradeChoice(
  unit: StoredBlock<"multiple-choice", typeof choiceUnitFields>,
  answer: StoredTaggedObject<"multiple-choice", typeof choiceAnswerFields> | undefined,
): "correct" | "incorrect" | "unassessed" {
  const options = unit.options.children()
  if (!options.length) return "unassessed"
  if (!answer) return "incorrect"
  return options.every(
    (option) =>
      (answer.selected.get(option.optionId.get())?.get() ?? false) === option.isCorrect.get(),
  )
    ? "correct"
    : "incorrect"
}
