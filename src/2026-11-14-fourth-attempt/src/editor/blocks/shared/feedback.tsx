import { RichText } from "../../components/RichText"
import { StaticRichText } from "../../components/StaticRichText"
import { richText as definition } from "../../rich-text"
import { richText, string } from "../../schema"
import type { StoredRichText } from "../../schema/rich-text"
import type { StoredTaggedObject } from "../../schema/tagged-object"
import { WorksheetMode } from "../../worksheet"

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
  entry: StoredTaggedObject<string, typeof feedbackFields> | undefined
  mode: WorksheetMode
}) {
  if (!entry) return null
  const comment = entry.comment
  const selectedResult = entry.result.get()
  const automaticResult = entry.automaticResult.get()
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
          onChange={(event) => entry.result.set(event.currentTarget.value)}
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

function FeedbackComment({ label, value }: { label: string; value: StoredRichText }) {
  return (
    <div className="feedback-comment" role="group" aria-label={label}>
      <span>{label}</span>
      <RichText value={value} />
    </div>
  )
}
