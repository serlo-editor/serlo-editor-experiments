import { useEffect, useMemo, useState } from "react"

import { Editor } from "../editor"
import { createBackend, fallBackToLocal } from "../sync"
import { type ExerciseType, exerciseTypes } from "./initial-content"
import { useViewers } from "./presence"
import { Preview } from "./Preview"
import { type DemoSession, openDemoSessions } from "./sessions"

export default function App() {
  const [sessionsByType, setSessionsByType] = useState<Map<ExerciseType, DemoSession> | null>(null)
  const [exerciseType, setExerciseType] = useState<ExerciseType>("single-choice")
  const [previewVersion, resetPreview] = useState(0)
  const [connectionError, setConnectionError] = useState<string | null>(null)

  // every exercise type has its own room, so switching keeps its state
  useEffect(() => {
    let closed = false
    // Unreachable servers (offline despite `navigator.onLine`, blocked, down) end in a timeout.
    const pending = openDemoSessions(createBackend()).catch((error: unknown) => {
      if (closed) throw error
      return openDemoSessions(fallBackToLocal(String(error)))
    })
    pending.then(
      (next) => {
        if (!closed) setSessionsByType(next)
      },
      (error: unknown) => {
        if (!closed) setConnectionError(String(error))
      },
    )
    return () => {
      closed = true
      pending.then(
        (next) => next.forEach((demo) => demo.close()),
        () => {},
      )
    }
  }, [])

  const editorSessions = useMemo(
    () =>
      sessionsByType && new Map([...sessionsByType].map(([type, { session }]) => [type, session])),
    [sessionsByType],
  )
  const viewers = useViewers(editorSessions, exerciseType)

  const session = sessionsByType?.get(exerciseType)?.session
  if (connectionError)
    return <main className="app">Verbindung fehlgeschlagen: {connectionError}</main>
  if (!session)
    return (
      <main className="app app--loading" aria-busy="true">
        <span className="spinner" aria-hidden="true" />
        Loading...
      </main>
    )

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
              {viewers.get(id)?.length ? (
                <span className="app__viewers">
                  {viewers.get(id)?.map(({ clientId, name, color }) => (
                    <span
                      key={clientId}
                      className="app__viewer"
                      style={{ backgroundColor: color }}
                      title={name}
                    />
                  ))}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
      </header>

      <div className="app__workspace">
        <section className="app__authoring" aria-label="Inhalt bearbeiten">
          <Editor key={exerciseType} session={session} showName={false} />
        </section>

        <section className="app__preview" aria-label="Vorschau">
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
          <div className="app__device">
            <span className="app__device-button app__device-button--upper" aria-hidden="true" />
            <span className="app__device-button app__device-button--lower" aria-hidden="true" />
            <div className="app__screen">
              <Preview key={`${exerciseType}-${previewVersion}`} session={session} />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
