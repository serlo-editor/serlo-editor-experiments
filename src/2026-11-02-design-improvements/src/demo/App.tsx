import { useEffect, useState } from "react"

import { Editor } from "../editor"
import { type ExerciseType, exerciseTypes } from "./initial-content"
import { Preview } from "./Preview"
import { createDemoSessions, type DemoSessions } from "./sessions"

export default function App() {
  const [sessionsByType, setSessionsByType] = useState<Map<ExerciseType, DemoSessions> | null>(null)
  const [exerciseType, setExerciseType] = useState<ExerciseType>("single-choice")
  const [previewVersion, resetPreview] = useState(0)
  const [rightPane, setRightPane] = useState<"preview" | "collaboration">("preview")

  // every exercise type keeps its own synchronized documents, so switching keeps its state
  useEffect(() => {
    const next = new Map(exerciseTypes.map(({ id, content }) => [id, createDemoSessions(content)]))
    setSessionsByType(next)
    return () => next.forEach((sessions) => sessions.destroy())
  }, [])

  const sessions = sessionsByType?.get(exerciseType)
  if (!sessions) return <main className="app">Loading...</main>

  return (
    <main className="app">
      <header className="app__header">
        <h1>Serlo Editor</h1>
        <nav className="app__types" aria-label="Aufgabentyp">
          {exerciseTypes.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={id === exerciseType}
              onClick={() => setExerciseType(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="app__view-switch" role="group" aria-label="Ansicht im rechten Bereich">
          <button
            type="button"
            aria-pressed={rightPane === "preview"}
            aria-controls="right-pane-preview"
            onClick={() => setRightPane("preview")}
          >
            Vorschau
          </button>
          <button
            type="button"
            aria-pressed={rightPane === "collaboration"}
            aria-controls="right-pane-collaboration"
            onClick={() => setRightPane("collaboration")}
          >
            Zusammenarbeit
          </button>
        </div>
      </header>

      <div className="app__workspace">
        <section className="app__authoring" aria-label="Inhalt bearbeiten">
          <Editor
            key={exerciseType}
            session={sessions.first}
            showName={rightPane === "collaboration"}
          />
        </section>

        <section
          className={`app__preview${rightPane === "collaboration" ? " app__preview--collaboration" : ""}`}
          aria-label={rightPane === "preview" ? "Vorschau" : "Zusammenarbeit"}
        >
          {rightPane === "preview" && (
            <header className="app__preview-header">
              <h2 className="app__preview-title">Vorschau</h2>
              <button
                type="button"
                className="app__reset"
                aria-label="Vorschau zurücksetzen"
                title="Vorschau zurücksetzen"
                onClick={() => resetPreview((version) => version + 1)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="M4 4v6h6M4.5 9a8 8 0 1 1-.2 6" />
                </svg>
              </button>
            </header>
          )}
          <div id="right-pane-preview" className="app__device" hidden={rightPane !== "preview"}>
            <span className="app__device-button app__device-button--upper" aria-hidden="true" />
            <span className="app__device-button app__device-button--lower" aria-hidden="true" />
            <div className="app__screen">
              <Preview key={`${exerciseType}-${previewVersion}`} session={sessions.first} />
            </div>
          </div>
          <div
            id="right-pane-collaboration"
            className="app__collaboration"
            hidden={rightPane !== "collaboration"}
          >
            <Editor key={exerciseType} session={sessions.second} />
          </div>
        </section>
      </div>
    </main>
  )
}
