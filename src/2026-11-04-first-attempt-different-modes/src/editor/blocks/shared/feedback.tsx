import { RichText } from "../../components/RichText"
import { StaticRichText } from "../../components/StaticRichText"
import type { RichTextJSON } from "../../rich-text"
import { richText as definition } from "../../rich-text"
import { richText, string } from "../../schema"
import type { StoredBlock } from "../../schema/block"
import type { StoredRichText } from "../../schema/rich-text"
import { useWorksheet } from "../../worksheet-context"
import { WorksheetMode } from "../../worksheet-mode"

const comment = richText({
  definition: definition.block({
    marks: { bold: true, italic: true },
    blocks: { paragraph: true, orderedList: true, bulletList: true },
  }),
})
export const feedbackFields = { comment, result: string(), automaticResult: string() }

const results = [
  { value: "unassessed", label: "Noch nicht bewertet" },
  { value: "correct", label: "Richtig" },
  { value: "partial", label: "Teilweise richtig" },
  { value: "incorrect", label: "Falsch" },
]

export function ExerciseFeedback({
  entry,
  mode,
}: {
  entry: StoredBlock<"gap-feedback" | "choice-feedback", typeof feedbackFields> | undefined
  mode: WorksheetMode
}) {
  if (!entry) return null
  const comment = entry.field("comment")
  const selectedResult = entry.field("result").get()
  const automaticResult = entry.field("automaticResult").get()
  const result = selectedResult === "automatic" ? automaticResult : selectedResult
  const label = results.find((item) => item.value === result)?.label ?? result
  if (mode !== WorksheetMode.GivingFeedback) {
    if (!comment.getEditor().state.doc.textContent.trim() && result === "unassessed") return null
    return (
      <aside className="feedback-card" data-result={result} aria-label="Feedback zur Aufgabe">
        <strong className="feedback-card__result">{label}</strong>
        <StaticRichText value={comment} />
      </aside>
    )
  }
  return (
    <fieldset className="feedback-card" data-result={result}>
      <legend>Feedback zur Aufgabe</legend>
      <label>
        Bewertung
        <select
          value={selectedResult}
          onChange={(event) => entry.field("result").set(event.currentTarget.value)}
        >
          <option value="automatic">
            Automatisch: {results.find((item) => item.value === automaticResult)?.label}
          </option>
          {results.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <FeedbackComment label="Kommentar" value={comment} />
    </fieldset>
  )
}

export function OverallFeedback() {
  const { mode, feedback } = useWorksheet()
  const overall = feedback.document.root.field("overall")
  if (mode !== WorksheetMode.GivingFeedback)
    return overall.getEditor().state.doc.textContent.trim() ? (
      <aside className="feedback-card">
        <h3>Gesamtfeedback</h3>
        <StaticRichText value={overall} />
      </aside>
    ) : null
  return (
    <section className="feedback-card">
      <FeedbackComment label="Gesamtfeedback" value={overall} />
    </section>
  )
}

function FeedbackComment({ label, value }: { label: string; value: StoredRichText }) {
  return (
    <div className="feedback-comment" role="group" aria-label={label}>
      <span>{label}</span>
      <RichText value={value} />
    </div>
  )
}

export function feedbackText(text = ""): RichTextJSON {
  return {
    type: "doc",
    content: [
      text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" },
    ],
  }
}
