import { ExerciseBadge } from "../components/ExerciseBadge"
import { ExerciseFeedback } from "../components/Feedback"
import { RichText } from "../components/RichText"
import { GapText, StaticRichText } from "../components/StaticRichText"
import { setChoiceAnswer } from "../responses"
import { richText as definition } from "../rich-text"
import { array, block, blockUnion, boolean, object, richText, string } from "../schema"
import type { SnapshotOf, StoredValueOf } from "../schema/types"
import { useWorksheet } from "../worksheet-context"

const textDefinition = definition.block({
  marks: { bold: true, italic: true },
  blocks: { paragraph: true, heading: true, orderedList: true, bulletList: true },
})

export const TextContent = block({
  type: "text",
  fields: { content: richText({ definition: textDefinition }) },
  render: function TextView({ value }) {
    const { mode } = useWorksheet()
    return mode === "authoring" ? (
      <RichText value={value.field("content")} />
    ) : (
      <StaticRichText value={value.field("content")} />
    )
  },
})

const gapDefinition = definition.block({
  marks: { bold: true, italic: true, gap: true },
  blocks: { paragraph: true },
})

export const FillInTheBlank = block({
  type: "fill-in-the-blank",
  fields: { content: richText({ definition: gapDefinition }) },
  render: function GapView({ value }) {
    const { mode } = useWorksheet()
    return (
      <section className="exercise exercise--fill-blank">
        <ExerciseBadge
          label="Lückentext"
          help={
            mode === "authoring"
              ? "Markiere Wörter als Lücken mit der Gap-Funktion."
              : "Tippe die richtigen Antworten in die Lücken."
          }
        />
        {mode === "authoring" ? (
          <RichText value={value.field("content")} />
        ) : (
          <>
            <p className="exercise__instructions">Tippe die richtigen Antworten in die Lücken.</p>
            <GapText value={value.field("content")} exerciseId={value.id} />
            <ExerciseFeedback exerciseId={value.id} kind="gap-feedback" />
          </>
        )}
      </section>
    )
  },
})

const inlineDefinition = definition.inline({ marks: { bold: true, italic: true } })

export const MultipleChoice = block({
  type: "multiple-choice",
  fields: {
    question: richText({ definition: inlineDefinition }),
    options: array(
      object({
        optionId: string(),
        isCorrect: boolean(),
        text: richText({ definition: inlineDefinition }),
      }),
    ),
  },
  render: function ChoiceView({ value }) {
    const { mode, answers } = useWorksheet()
    const answer = answers?.document.root.get(value.id)
    if (answer && answer.type !== "choice-answer")
      return <p role="alert">Antwort passt nicht zur Aufgabe.</p>
    return (
      <section className="exercise exercise--multiple-choice">
        <ExerciseBadge label="Multiple Choice" help="Mehrere Antworten können richtig sein." />
        {mode === "authoring" ? (
          <>
            <h3 className="exercise__field-label">Aufgabenstellung</h3>
            <div className="answer-input exercise__question">
              <RichText value={value.field("question")} inline />
            </div>
            <h3 className="exercise__field-label">Antworten</h3>
            <ul className="multiple-choice-options">
              {value.field("options").map((option) => {
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
              <StaticRichText value={value.field("question")} inline />
            </div>
            <div className="choice-options">
              {value.field("options").map((option) => {
                const optionId = option.field("optionId").get()
                return (
                  <label key={optionId} className="choice-card">
                    <StaticRichText value={option.field("text")} inline />
                    <input
                      type="checkbox"
                      checked={answer?.field("selected").get(optionId)?.get() ?? false}
                      disabled={mode !== "answering" || !answers}
                      onChange={(event) => {
                        if (mode === "answering" && answers)
                          setChoiceAnswer(
                            answers.document.root,
                            value.id,
                            optionId,
                            event.currentTarget.checked,
                          )
                      }}
                    />
                  </label>
                )
              })}
            </div>
            <ExerciseFeedback exerciseId={value.id} kind="choice-feedback" />
          </>
        )}
      </section>
    )
  },
})

export const Root = array(blockUnion([TextContent, FillInTheBlank, MultipleChoice]))
export type RootValue = StoredValueOf<typeof Root>
export type RootSnapshot = SnapshotOf<typeof Root>
