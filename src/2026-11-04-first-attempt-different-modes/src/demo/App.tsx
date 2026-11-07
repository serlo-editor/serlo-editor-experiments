import { useEffect, useState } from "react"

import {
  clearFollowingDocuments,
  createModeDocuments,
  Editor,
  WorksheetMode,
  type WorksheetDocuments,
} from "../editor"
import { useStorage } from "../editor/use-storage"
import { initialContent } from "./initial-content"
import { createDemoSessions } from "./sessions"

const modes: { id: WorksheetMode; label: string }[] = [
  { id: WorksheetMode.EditingContent, label: "1. Inhalt bearbeiten" },
  { id: WorksheetMode.Answering, label: "2. Aufgaben lösen" },
  { id: WorksheetMode.GivingFeedback, label: "3. Feedback geben" },
  { id: WorksheetMode.ViewingFeedback, label: "4. Feedback ansehen" },
]

export default function App() {
  const [workspace, setWorkspace] = useState<{
    sessions: ReturnType<typeof createDemoSessions>
    first: WorksheetDocuments
    second: WorksheetDocuments
  } | null>(null)
  const [rightPane, setRightPane] = useState<"documents" | "collaboration">("collaboration")

  useEffect(() => {
    const sessions = createDemoSessions(initialContent)
    setWorkspace({
      sessions,
      first: createModeDocuments(WorksheetMode.EditingContent, sessions.first, sessions.responses),
      second: createModeDocuments(
        WorksheetMode.EditingContent,
        sessions.second,
        sessions.secondResponses,
      ),
    })
    return () => sessions.destroy()
  }, [])

  if (!workspace) return <main className="app">Loading...</main>
  const { sessions, first: worksheet, second } = workspace
  const mode = worksheet.mode

  return (
    <main className="app">
      <header className="app__header">
        <h1>Ein Arbeitsblatt · drei Dokumente</h1>
        <div className="app__header-controls">
          <nav className="app__view-switch" aria-label="Arbeitsmodus">
            {modes.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={mode === item.id}
                onClick={() => {
                  if (item.id === mode) return
                  clearFollowingDocuments(item.id, sessions.responses)
                  setWorkspace({
                    sessions,
                    first: createModeDocuments(item.id, sessions.first, sessions.responses),
                    second: createModeDocuments(item.id, sessions.second, sessions.secondResponses),
                  })
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="app__view-switch" role="group" aria-label="Rechter Bereich">
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
        </div>
      </header>
      <div className="app__workspace">
        <section className="app__authoring" aria-label="Aktiver Arbeitsbereich">
          <Editor
            key={mode}
            worksheet={worksheet}
            name={sessions.first.name}
            color={sessions.first.color}
          />
        </section>
        <aside
          className={
            rightPane === "collaboration"
              ? "app__preview app__preview--collaboration"
              : "app__preview"
          }
          aria-label="Zusammenarbeit und Dokumente"
        >
          <div hidden={rightPane !== "collaboration"}>
            <Editor
              key={mode}
              worksheet={second}
              name={sessions.second.name}
              color={sessions.second.color}
            />
          </div>
          <div hidden={rightPane !== "documents"}>
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
        <dd>
          {worksheet.mode === WorksheetMode.EditingContent
            ? "Yjs · bearbeitbar"
            : "Yjs · schreibgeschützt"}
        </dd>
        <dt>Antworten</dt>
        <dd>
          {worksheet.answers
            ? worksheet.mode === WorksheetMode.Answering
              ? "Yjs · bearbeitbar"
              : "Yjs · schreibgeschützt"
            : "Nicht eingebunden"}
        </dd>
        <dt>Feedback</dt>
        <dd>
          {worksheet.feedback
            ? worksheet.mode === WorksheetMode.GivingFeedback
              ? "Yjs · bearbeitbar"
              : "Yjs · schreibgeschützt"
            : "Nicht eingebunden"}
        </dd>
      </dl>
      <p className="documents__note">
        Alle drei Dokumente synchronisieren unabhängig über Yjs. Schreibgeschützte Ansichten bleiben
        live aktuell. Beim Moduswechsel werden Daten nachfolgender Modi gelöscht: zurück zum Inhalt
        löscht Antworten und Feedback, zurück zu den Aufgaben löscht Feedback.
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
