import { useEffect, useMemo, useState } from "react"

import { createModeDocuments, Editor, type Mode, type WorksheetDocuments } from "../editor"
import { useStorage } from "../editor/use-storage"
import { initialContent } from "./initial-content"
import { createDemoSessions } from "./sessions"

const modes: { id: Mode; label: string }[] = [
  { id: "authoring", label: "1. Inhalt bearbeiten" },
  { id: "answering", label: "2. Aufgaben lösen" },
  { id: "feedback", label: "3. Feedback geben" },
  { id: "viewing", label: "4. Feedback ansehen" },
]

export default function App() {
  const [sessions, setSessions] = useState<ReturnType<typeof createDemoSessions> | null>(null)
  const [mode, setMode] = useState<Mode>("authoring")
  const [rightPane, setRightPane] = useState<"documents" | "collaboration">("collaboration")

  useEffect(() => {
    const next = createDemoSessions(initialContent)
    setSessions(next)
    return () => next.destroy()
  }, [])

  const worksheet = useMemo(
    () => (sessions ? createModeDocuments(mode, sessions.first, sessions.student) : null),
    [sessions, mode],
  )
  if (!sessions || !worksheet) return <main className="app">Loading...</main>
  const current = modes.find((item) => item.id === mode)

  return (
    <main className="app">
      <header className="app__header">
        <h1>Ein Arbeitsblatt · drei Dokumente</h1>
        <nav className="app__view-switch" aria-label="Arbeitsmodus">
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={mode === item.id}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <div className="app__workspace">
        <section className="app__authoring" aria-label="Aktiver Arbeitsbereich">
          <Editor
            key={mode}
            worksheet={worksheet}
            name={mode === "authoring" ? sessions.first.name : (current?.label.slice(3) ?? "")}
            color={mode === "feedback" ? "#b45309" : sessions.first.color}
          />
        </section>
        <aside className="app__preview" aria-label="Zusammenarbeit und Dokumente">
          {mode === "authoring" && (
            <div
              className="app__view-switch app__side-switch"
              role="group"
              aria-label="Rechter Bereich"
            >
              <button
                type="button"
                aria-pressed={rightPane === "collaboration"}
                onClick={() => setRightPane("collaboration")}
              >
                Zusammenarbeit
              </button>
              <button
                type="button"
                aria-pressed={rightPane === "documents"}
                onClick={() => setRightPane("documents")}
              >
                Dokumente
              </button>
            </div>
          )}
          {mode === "authoring" && (
            <div hidden={rightPane !== "collaboration"}>
              <Editor
                worksheet={{ mode, content: sessions.second }}
                name={sessions.second.name}
                color={sessions.second.color}
              />
            </div>
          )}
          <div hidden={mode === "authoring" && rightPane !== "documents"}>
            <Documents worksheet={worksheet} />
          </div>
        </aside>
      </div>
    </main>
  )
}

function Documents({ worksheet }: { worksheet: WorksheetDocuments }) {
  useStorage(worksheet.content.store)
  useStorage(worksheet.answers?.store)
  useStorage(worksheet.feedback?.store)
  return (
    <section className="documents">
      <h2>Unabhängige Dokumente</h2>
      <p>Inhalt, Antworten und Feedback werden getrennt gespeichert.</p>
      <dl className="document-status">
        <dt>Inhalt</dt>
        <dd>{worksheet.mode === "authoring" ? "Yjs · bearbeitbar" : "Read-only · gesperrt"}</dd>
        <dt>Antworten</dt>
        <dd>
          {worksheet.answers
            ? worksheet.mode === "answering"
              ? "Flat · bearbeitbar"
              : "Read-only · gesperrt"
            : "Nicht eingebunden"}
        </dd>
        <dt>Feedback</dt>
        <dd>
          {worksheet.feedback
            ? worksheet.mode === "feedback"
              ? "Flat · bearbeitbar"
              : "Read-only · gesperrt"
            : "Nicht eingebunden"}
        </dd>
      </dl>
      <p className="documents__note">
        Antworten und Feedback referenzieren Aufgaben über stabile IDs. Inhaltsänderungen werden
        beim nächsten Moduswechsel übernommen; bestehende Antworten bleiben erhalten. Inhaltliche
        Änderungen können Antworten ungültig machen.
      </p>
      <DocumentJSON label="Inhalt" document={worksheet.content.document} />
      {worksheet.answers && (
        <DocumentJSON label="Antworten" document={worksheet.answers.document} />
      )}
      {worksheet.feedback && (
        <DocumentJSON label="Feedback" document={worksheet.feedback.document} />
      )}
      <p className="documents__note">
        Debug-Ansicht enthält auch Lösungen. Schreibschutz ist keine Zugriffskontrolle.
      </p>
    </section>
  )
}

function DocumentJSON({ label, document }: { label: string; document: { snapshot(): unknown } }) {
  return (
    <details className="document-json">
      <summary>{label} · JSON</summary>
      <pre>{JSON.stringify(document.snapshot(), null, 2)}</pre>
    </details>
  )
}
