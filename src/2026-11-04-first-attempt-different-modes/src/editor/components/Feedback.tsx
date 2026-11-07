import type { feedbackFields } from "../content/exercises"
import { setExerciseFeedback } from "../responses"
import type { StoredBlock } from "../schema/block"
import type { StoredRichText } from "../schema/rich-text"
import { WorksheetMode } from "../worksheet"
import { useWorksheet } from "../worksheet-context"
import { RichText } from "./RichText"
import { StaticRichText } from "./StaticRichText"

const results = [
  { value: "unassessed", label: "Noch nicht bewertet" },
  { value: "correct", label: "Richtig" },
  { value: "partial", label: "Teilweise richtig" },
  { value: "incorrect", label: "Falsch" },
]

export function ExerciseFeedback({
  entry,
  exerciseId,
  kind,
  mode,
}: {
  entry: StoredBlock<"gap-feedback" | "choice-feedback", typeof feedbackFields> | undefined
  exerciseId: string
  kind: "gap-feedback" | "choice-feedback"
  mode: WorksheetMode
}) {
  const { feedback } = useWorksheet()
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
          onChange={(event) => {
            if (feedback)
              setExerciseFeedback(
                feedback.document.root,
                exerciseId,
                kind,
                "result",
                event.currentTarget.value,
              )
          }}
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
  if (!feedback) return null
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
