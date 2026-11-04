import { setExerciseFeedback } from "../responses"
import { useWorksheet } from "../worksheet-context"

const results = [
  { value: "unassessed", label: "Noch nicht bewertet" },
  { value: "correct", label: "Richtig" },
  { value: "partial", label: "Teilweise richtig" },
  { value: "incorrect", label: "Noch einmal versuchen" },
]

export function ExerciseFeedback({
  exerciseId,
  kind,
}: {
  exerciseId: string
  kind: "gap-feedback" | "choice-feedback"
}) {
  const { mode, feedback } = useWorksheet()
  if (!feedback) return null
  const entry = feedback.document.root.field("exercises").get(exerciseId)
  if (entry && entry.type !== kind) return <p role="alert">Feedback passt nicht zur Aufgabe.</p>
  const comment = entry?.field("comment").get() ?? ""
  const result = entry?.field("result").get() ?? "unassessed"
  if (mode !== "feedback") {
    if (!comment && result === "unassessed") return null
    return (
      <aside className="feedback-card" aria-label="Feedback zur Aufgabe">
        <strong>{results.find((item) => item.value === result)?.label ?? result}</strong>
        {comment && <p>{comment}</p>}
      </aside>
    )
  }
  return (
    <fieldset className="feedback-card">
      <legend>Feedback zur Aufgabe</legend>
      <label>
        Bewertung
        <select
          value={result}
          onChange={(event) =>
            setExerciseFeedback(
              feedback.document.root,
              exerciseId,
              kind,
              "result",
              event.currentTarget.value,
            )
          }
        >
          {results.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        Kommentar
        <textarea
          value={comment}
          placeholder="Rückmeldung zu dieser Antwort …"
          onChange={(event) =>
            setExerciseFeedback(
              feedback.document.root,
              exerciseId,
              kind,
              "comment",
              event.currentTarget.value,
            )
          }
        />
      </label>
    </fieldset>
  )
}

export function OverallFeedback() {
  const { mode, feedback } = useWorksheet()
  if (!feedback) return null
  const overall = feedback.document.root.field("overall")
  if (mode !== "feedback")
    return overall.get() ? (
      <aside className="feedback-card">
        <h3>Gesamtfeedback</h3>
        <p>{overall.get()}</p>
      </aside>
    ) : null
  return (
    <label className="feedback-card">
      Gesamtfeedback
      <textarea
        value={overall.get()}
        placeholder="Zusammenfassende Rückmeldung …"
        onChange={(event) => overall.set(event.currentTarget.value)}
      />
    </label>
  )
}
