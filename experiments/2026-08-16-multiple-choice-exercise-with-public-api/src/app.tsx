import type { ReactNode } from "react"

import "./app.css"

type EditorMode = "authoring" | "learning" | "feedback-authoring" | "feedback-viewing"

type Choice = {
  readonly id: string
  readonly label: string
  readonly text: string
  readonly correct: boolean
}

type ModeInfo = {
  readonly id: EditorMode
  readonly title: string
  readonly description: string
}

type ChoiceListLayout = "editable" | "selectable" | "review"

const documentType = {
  id: "multiple-choice-exercise",
  label: "Multiple choice exercise",
} as const

const modes: readonly ModeInfo[] = [
  {
    id: "authoring",
    title: "Authoring",
    description: "Edit the question and answer options.",
  },
  {
    id: "learning",
    title: "Learning",
    description: "Let the learner pick one answer.",
  },
  {
    id: "feedback-authoring",
    title: "Feedback authoring",
    description: "Write feedback for the learner response.",
  },
  {
    id: "feedback-viewing",
    title: "Feedback viewing",
    description: "Show the finished result and feedback.",
  },
]

const choices: readonly Choice[] = [
  { id: "a", label: "A", text: "Mercury", correct: true },
  { id: "b", label: "B", text: "Venus", correct: false },
  { id: "c", label: "C", text: "Mars", correct: false },
  { id: "d", label: "D", text: "Jupiter", correct: false },
]

export default function App() {
  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Serlo editor public API prototype</p>
          <h1>Multiple choice editor</h1>
          <p className="lede">
            One document type only: <strong>{documentType.id}</strong>. No collaboration.
          </p>
        </div>

        <div className="badges">
          <span className="badge">schema: serlo-document</span>
          <span className="badge">version: 1</span>
          <span className="badge">type: {documentType.label}</span>
        </div>
      </header>

      <section className="meta">
        <div className="section-head">
          <h2>Modes</h2>
          <span className="badge badge--soft">4 previews</span>
        </div>

        <div className="mode-chips">
          {modes.map((mode) => (
            <span className="badge badge--soft" key={mode.id}>
              {mode.id}
            </span>
          ))}
        </div>
      </section>

      <section className="mode-grid">
        {modes.map((mode) => (
          <ModeCard key={mode.id} mode={mode}>
            {renderMode(mode.id)}
          </ModeCard>
        ))}
      </section>
    </main>
  )
}

function ModeCard({ mode, children }: { readonly mode: ModeInfo; readonly children: ReactNode }) {
  return (
    <article className="card">
      <header className="card__header">
        <div>
          <p className="eyebrow">{mode.id}</p>
          <h3>{mode.title}</h3>
          <p className="muted">{mode.description}</p>
        </div>

        <span className="badge badge--soft">no collaboration</span>
      </header>

      {children}
    </article>
  )
}

function renderMode(mode: EditorMode): ReactNode {
  switch (mode) {
    case "authoring":
      return <AuthoringMode />
    case "learning":
      return <LearningMode />
    case "feedback-authoring":
      return <FeedbackAuthoringMode />
    case "feedback-viewing":
      return <FeedbackViewingMode />
  }
}

function AuthoringMode() {
  return (
    <>
      <section className="section">
        <div className="section-head">
          <h4>Question</h4>
          <span className="badge badge--soft">content</span>
        </div>

        <textarea defaultValue="Which planet is closest to the Sun?" rows={3} />
      </section>

      <section className="section">
        <div className="section-head">
          <h4>Answers</h4>
          <button type="button">Add answer</button>
        </div>

        <ChoiceList layout="editable" />
      </section>

      <div className="toolbar">
        <button type="button">Preview</button>
        <button type="button" className="primary">
          Save draft
        </button>
      </div>
    </>
  )
}

function LearningMode() {
  const selectedChoice = choices[1]

  return (
    <>
      <section className="section">
        <div className="section-head">
          <h4>Question</h4>
          <span className="badge badge--soft">response</span>
        </div>

        <p className="question">Which planet is closest to the Sun?</p>
        <ChoiceList layout="selectable" selectedId={selectedChoice.id} />
      </section>

      <div className="toolbar">
        <button type="button" className="primary">
          Check answer
        </button>
      </div>
    </>
  )
}

function FeedbackAuthoringMode() {
  const selectedChoice = choices[1]

  return (
    <>
      <section className="section">
        <div className="callout">
          Learner response: {selectedChoice.label} · {selectedChoice.text}
        </div>

        <div className="split">
          <label className="field">
            <span>Overall feedback</span>
            <textarea defaultValue="Mercury is the closest planet to the Sun." rows={4} />
          </label>

          <label className="field">
            <span>Teacher notes</span>
            <textarea
              defaultValue="Explain why the correct option is closest, then mention why the selected answer is not."
              rows={4}
            />
          </label>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h4>Choices</h4>
          <span className="badge badge--soft">feedback</span>
        </div>

        <ChoiceList layout="review" selectedId={selectedChoice.id} />
      </section>
    </>
  )
}

function FeedbackViewingMode() {
  const selectedChoice = choices[1]
  const correctChoice = choices[0]

  return (
    <>
      <section className="section">
        <div className="callout callout--success">
          Correct answer: {correctChoice.label} · {correctChoice.text}
        </div>

        <p className="muted">
          Learner response: {selectedChoice.label} · {selectedChoice.text}
        </p>

        <p>{correctChoice.label} is the closest planet to the Sun.</p>
      </section>

      <section className="section">
        <div className="section-head">
          <h4>Choices</h4>
          <span className="badge badge--soft">read only</span>
        </div>

        <ChoiceList layout="review" selectedId={selectedChoice.id} />
      </section>
    </>
  )
}

function ChoiceList({
  layout,
  selectedId,
}: {
  readonly layout: ChoiceListLayout
  readonly selectedId?: string
}) {
  return (
    <div className="choices">
      {choices.map((choice) => {
        const className = [
          "choice",
          `choice--${layout}`,
          choice.correct ? "choice--correct" : "",
          selectedId === choice.id ? "choice--selected" : "",
        ]
          .filter(Boolean)
          .join(" ")

        if (layout === "editable") {
          return (
            <div className={className} key={choice.id}>
              <span className="choice__label">{choice.label}</span>
              <input defaultValue={choice.text} />
              <label className="choice__flag">
                <input type="checkbox" defaultChecked={choice.correct} />
                Correct
              </label>
            </div>
          )
        }

        if (layout === "selectable") {
          return (
            <label className={className} key={choice.id}>
              <input type="radio" name="answer" defaultChecked={selectedId === choice.id} />
              <span className="choice__label">{choice.label}</span>
              <span className="choice__text">{choice.text}</span>
            </label>
          )
        }

        return (
          <div className={className} key={choice.id}>
            <span className="choice__label">{choice.label}</span>
            <span className="choice__text">{choice.text}</span>
            <span className="choice__flag">
              {choice.correct ? "Correct" : selectedId === choice.id ? "Learner response" : "Wrong"}
            </span>
          </div>
        )
      })}
    </div>
  )
}
