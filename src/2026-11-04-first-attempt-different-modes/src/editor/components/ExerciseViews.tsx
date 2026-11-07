import type {
  choiceAnswerFields,
  choiceUnitFields,
  feedbackFields,
  gapAnswerFields,
  gapUnitFields,
} from "../content/exercises"
import { setChoiceAnswer } from "../responses"
import type { StoredBlock } from "../schema/block"
import { WorksheetMode } from "../worksheet"
import { useWorksheet } from "../worksheet-context"
import { ExerciseBadge } from "./ExerciseBadge"
import { ExerciseFeedback } from "./Feedback"
import { RichText } from "./RichText"
import { GapText, StaticRichText } from "./StaticRichText"

export function GapView({
  unit,
  answer,
  feedback,
  mode,
}: {
  unit: StoredBlock<"fill-in-the-blank", typeof gapUnitFields>
  answer: StoredBlock<"gap-answer", typeof gapAnswerFields> | undefined
  feedback: StoredBlock<"gap-feedback", typeof feedbackFields> | undefined
  mode: WorksheetMode
}) {
  return (
    <section className="exercise exercise--fill-blank">
      <ExerciseBadge
        label="Lückentext"
        help={
          mode === WorksheetMode.EditingContent
            ? "Markiere Wörter als Lücken mit der Gap-Funktion."
            : "Tippe die richtigen Antworten in die Lücken."
        }
      />
      {mode === WorksheetMode.EditingContent ? (
        <RichText value={unit.field("content")} />
      ) : (
        <>
          <p className="exercise__instructions">Tippe die richtigen Antworten in die Lücken.</p>
          <GapText value={unit.field("content")} exerciseId={unit.id} answer={answer} mode={mode} />
          <ExerciseFeedback entry={feedback} exerciseId={unit.id} kind="gap-feedback" mode={mode} />
        </>
      )}
    </section>
  )
}

export function ChoiceView({
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
                    disabled={mode !== WorksheetMode.Answering || !answers}
                    onChange={(event) => {
                      if (mode === WorksheetMode.Answering && answers)
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
          <ExerciseFeedback
            entry={feedback}
            exerciseId={unit.id}
            kind="choice-feedback"
            mode={mode}
          />
        </>
      )}
    </section>
  )
}
