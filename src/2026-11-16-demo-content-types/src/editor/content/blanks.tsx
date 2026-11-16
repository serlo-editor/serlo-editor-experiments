import { ExerciseBadge } from "../components/ExerciseBadge"
import { RichTextField } from "../components/RichText"
import { richText as definition } from "../rich-text"
import { array, block, richText, string } from "../schema"
import { ExtraAnswersPanel } from "./shared"

const gapDefinition = definition.block({
  marks: { bold: true, italic: true, gap: true },
  blocks: { paragraph: true },
})
export const FillInTheBlank = block({
  type: "fill-in-the-blank",
  fields: { content: richText({ definition: gapDefinition }) },
  render: ({ value }) => (
    <div className="exercise exercise--fill-blank">
      <ExerciseBadge
        label="Lückentext"
        help="Markiere Wörter als Lücken mit der Lücken-Funktion."
      />
      <RichTextField handle={value.content} />
    </div>
  ),
})
export const DragAndDropBlanks = block({
  type: "drag-and-drop-blanks",
  fields: {
    content: richText({ definition: gapDefinition }),
    extraAnswers: array(string(), { defaultLength: 0 }),
  },
  render: ({ value }) => (
    <div className="exercise exercise--fill-blank">
      <ExerciseBadge
        label="Lückentext (Drag & Drop)"
        help="Markiere Wörter als Lücken. Lernende ziehen sie zurück in den Text."
      />
      <RichTextField handle={value.content} />
      <ExtraAnswersPanel
        answers={value.extraAnswers}
        hint="Zusätzliche Antworten, die in keine Lücke passen."
      />
    </div>
  ),
})
