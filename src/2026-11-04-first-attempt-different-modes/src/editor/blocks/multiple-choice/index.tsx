import { ExerciseBadge } from "../../components/ExerciseBadge"
import { RichText } from "../../components/RichText"
import { StaticRichText } from "../../components/StaticRichText"
import type { Answers } from "../../responses"
import { richText as definition } from "../../rich-text"
import { array, boolean, exercise, object, record, richText, string } from "../../schema"
import type { StoredBlock } from "../../schema/block"
import type { StoredValueOf } from "../../schema/types"
import { useWorksheet } from "../../worksheet-context"
import { WorksheetMode } from "../../worksheet-mode"
import { ExerciseFeedback, feedbackFields } from "../shared/feedback"

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
  answer: { type: "choice-answer", fields: choiceAnswerFields },
  feedback: { type: "choice-feedback", fields: feedbackFields },
  render: ChoiceView,
})

function ChoiceView({
  unit,
  answer,
  feedback,
  mode,
}: {
  unit: StoredBlock<"multiple-choice", typeof choiceUnitFields>
  answer: StoredBlock<"choice-answer", typeof choiceAnswerFields> | undefined
  feedback: StoredBlock<"choice-feedback", typeof feedbackFields> | undefined
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
            <RichText value={unit.field("question")} inline />
          </div>
          <h3 className="exercise__field-label">Antworten</h3>
          <ul className="multiple-choice-options">
            {unit.field("options").map((option) => {
              const correctness = option.field("isCorrect")
              return (
                <li key={option.field("optionId").get()}>
                  <div className="answer-input">
                    <RichText value={option.field("text")} inline />
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
            <StaticRichText value={unit.field("question")} inline />
          </div>
          <div className="choice-options">
            {unit.field("options").map((option) => {
              const optionId = option.field("optionId").get()
              return (
                <label key={optionId} className="choice-card">
                  <StaticRichText value={option.field("text")} inline />
                  <input
                    type="checkbox"
                    checked={answer?.field("selected").get(optionId)?.get() ?? false}
                    disabled={mode !== WorksheetMode.Answering}
                    onChange={(event) => {
                      if (mode === WorksheetMode.Answering)
                        setChoiceAnswer(
                          answers.document.root,
                          unit.id,
                          optionId,
                          event.currentTarget.checked,
                        )
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
  unit: StoredValueOf<typeof MultipleChoiceExercise.unit>,
  answer: ReturnType<StoredValueOf<typeof Answers>["get"]>,
): "correct" | "incorrect" | "unassessed" {
  const options = unit.field("options").children()
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

function setChoiceAnswer(
  answers: StoredValueOf<typeof Answers>,
  exerciseId: string,
  optionId: string,
  selected: boolean,
) {
  let answer = answers.get(exerciseId)
  if (!answer) {
    answers.set(exerciseId, MultipleChoiceExercise.answer.createSnapshot({ selected: {} }))
    answer = answers.get(exerciseId)
  }
  if (answer?.type !== "choice-answer") throw new Error("Incompatible answer type.")
  answer.field("selected").set(optionId, selected)
}
