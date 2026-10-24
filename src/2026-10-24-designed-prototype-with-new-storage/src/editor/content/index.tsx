import { ExerciseBadge } from "../components/ExerciseBadge"
import { RichText } from "../components/RichText"
import { richText as definition } from "../rich-text"
import { array, boolean, childUnit, object, richText, unit } from "../schema"
import type { HandleOf, SnapshotOf } from "../schema/types"

export const inlineDefinition = definition.inline({ marks: { bold: true, italic: true } })
export const textDefinition = definition.block({
  marks: { bold: true, italic: true },
  blocks: { paragraph: true, heading: true, orderedList: true, bulletList: true },
})
export const gapDefinition = definition.block({
  marks: { bold: true, italic: true, gap: true },
  blocks: { paragraph: true },
})

export const TextContent = unit({
  type: "text",
  fields: { content: richText({ definition: textDefinition }) },
  render: ({ handle }) => <RichText handle={handle.field("content")} />,
})

export const FillInTheBlank = unit({
  type: "fill-in-the-blank",
  fields: { content: richText({ definition: gapDefinition }) },
  render: ({ handle }) => (
    <div className="exercise exercise--fill-blank">
      <ExerciseBadge label="Lückentext" help="Markiere Wörter als Lücken mit der Gap-Funktion." />
      <RichText handle={handle.field("content")} />
    </div>
  ),
})

export const MultipleChoice = unit({
  type: "multiple-choice",
  fields: {
    question: richText({ definition: inlineDefinition }),
    options: array(
      object({
        isCorrect: boolean(),
        text: richText({ definition: inlineDefinition }),
      }),
    ),
  },
  render: ({ handle }) => (
    <div className="exercise exercise--multiple-choice">
      <ExerciseBadge label="Multiple Choice" help="Mehrere Antworten können richtig sein." />
      <h3 className="exercise__field-label">Aufgabenstellung</h3>
      <div className="answer-input exercise__question">
        <RichText handle={handle.field("question")} inline />
      </div>
      <h3 className="exercise__field-label">Antworten</h3>
      <ul className="multiple-choice-options">
        {handle.field("options").map((option) => {
          const text = option.field("text")
          const correctness = option.field("isCorrect")
          const isCorrect = correctness.get()
          return (
            <li key={text.id}>
              <div className="answer-input">
                <RichText handle={text} inline />
              </div>
              <label className={isCorrect ? "correctness correctness--correct" : "correctness"}>
                <input
                  type="checkbox"
                  checked={isCorrect}
                  onChange={(event) => correctness.set(event.currentTarget.checked)}
                />
                {isCorrect ? "Richtig" : "Falsch"}
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  ),
})

export const Root = array(childUnit([TextContent, FillInTheBlank, MultipleChoice]))
export type RootHandle = HandleOf<typeof Root>
export type RootSnapshot = SnapshotOf<typeof Root>
export type ContentHandle = ReturnType<RootHandle["children"]>[number]
