import "./app.css"

const choices = [
  { label: "A", text: "Mercury", correct: false },
  { label: "B", text: "Venus", correct: true },
  { label: "C", text: "Mars", correct: false },
  { label: "D", text: "Jupiter", correct: false },
]

export default function App() {
  return (
    <main className="editor-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Multiple choice</p>
          <h1>Edit view prototype</h1>
        </div>
        <div className="actions">
          <button type="button">Preview</button>
          <button type="button" className="primary">
            Save draft
          </button>
        </div>
      </header>

      <section className="panel">
        <label>
          Question
          <textarea defaultValue="Which planet is closest to the Sun?" rows={3} />
        </label>

        <div className="grid">
          <label>
            Points
            <input type="number" defaultValue={1} />
          </label>
          <label>
            Shuffle answers
            <select defaultValue="yes">
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>Answer choices</h2>
          <button type="button">Add choice</button>
        </div>

        <div className="choices">
          {choices.map((choice) => (
            <div className={`choice ${choice.correct ? "correct" : ""}`} key={choice.label}>
              <span className="choice-label">{choice.label}</span>
              <input defaultValue={choice.text} />
              <label className="check">
                <input type="checkbox" defaultChecked={choice.correct} />
                Correct
              </label>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
