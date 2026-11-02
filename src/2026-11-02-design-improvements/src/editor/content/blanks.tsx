import { ExerciseBadge } from "../components/ExerciseBadge"
import { RichTextField } from "../components/RichText"
import { richText as definition } from "../rich-text"
import { array, richText, string, unit } from "../schema"
import { ExtraAnswersPanel } from "./shared"

const gapDefinition = definition.block({
  marks: { bold: true, italic: true, gap: true },
  blocks: { paragraph: true },
})

export const FillInTheBlank = unit({
  type: "fill-in-the-blank",
  fields: { content: richText({ definition: gapDefinition }) },
  render: ({ handle }) => (
    <div className="exercise exercise--fill-blank">
      <ExerciseBadge
        label="Lückentext"
        help="Markiere Wörter als Lücken mit der Lücken-Funktion."
      />
      <RichTextField handle={handle.field("content")} />
    </div>
  ),
})

export const DragAndDropBlanks = unit({
  type: "drag-and-drop-blanks",
  fields: {
    content: richText({ definition: gapDefinition }),
    /** answers that fit no gap, mixed into the pool to make it harder */
    extraAnswers: array(string()),
  },
  render: ({ handle }) => (
    <div className="exercise exercise--fill-blank">
      <ExerciseBadge
        label="Lückentext (Drag & Drop)"
        help="Markiere Wörter als Lücken. Lernende ziehen sie zurück in den Text."
      />
      <RichTextField handle={handle.field("content")} />
      <ExtraAnswersPanel
        answers={handle.field("extraAnswers")}
        hint="Zusätzliche Antworten, die in keine Lücke passen. Sie werden mit den richtigen Antworten gemischt angeboten."
      />
    </div>
  ),
})
