import { FlatNodeStore } from "@editor/store"
import { openWorksheet, WorksheetMode } from "@editor/worksheet"
import { useEffect, useState, useSyncExternalStore } from "react"

import { initialContent } from "./initial-content"
import { Root, type RootSnapshot } from "./worksheet/blocks"
import { Editor, type EditorWorksheet } from "./worksheet/components/Editor"
import { Answers, Feedback, initialFeedback } from "./worksheet/responses"

const modes = [
  { id: WorksheetMode.EditingContent, label: "1. Inhalt bearbeiten" },
  { id: WorksheetMode.Answering, label: "2. Aufgaben lösen" },
  { id: WorksheetMode.GivingFeedback, label: "3. Feedback geben" },
  { id: WorksheetMode.ViewingFeedback, label: "4. Feedback ansehen" },
]

type Snapshot = {
  content: RootSnapshot
  answers: ReturnType<typeof Answers.defaultValue>
  feedback: ReturnType<typeof Feedback.defaultValue>
}
type Workspace = { worksheet: EditorWorksheet; generation: number }

function createWorkspace(mode: WorksheetMode, snapshot: Snapshot, generation: number): Workspace {
  return {
    generation,
    worksheet: openWorksheet({
      mode,
      createStore: () => new FlatNodeStore(),
      contentSchema: Root,
      answersSchema: Answers,
      feedbacksSchema: Feedback,
      initialSnapshot: {
        content: snapshot.content,
        answers: snapshot.answers,
        feedbacks: snapshot.feedback,
      },
    }),
  }
}

function nextSnapshot(worksheet: EditorWorksheet, mode: WorksheetMode): Snapshot {
  const content = worksheet.content.snapshot()
  const answers = mode === WorksheetMode.EditingContent ? {} : worksheet.answers.snapshot()
  const feedback =
    mode === WorksheetMode.EditingContent || mode === WorksheetMode.Answering
      ? initialFeedback()
      : worksheet.feedbacks.snapshot()
  return { content, answers, feedback }
}

export default function App() {
  const [workspace, setWorkspace] = useState(() =>
    createWorkspace(
      WorksheetMode.EditingContent,
      { content: initialContent, answers: {}, feedback: initialFeedback() },
      0,
    ),
  )
  const { worksheet, generation } = workspace
  useEffect(() => () => worksheet.dispose(), [worksheet])
  return (
    <main className="app">
      <header className="app__header">
        <h1>Ein Arbeitsblatt · drei Dokumente</h1>
        <nav className="app__view-switch" aria-label="Arbeitsmodus">
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={worksheet.mode === item.id}
              onClick={() => {
                if (item.id === worksheet.mode) return
                const snapshot = nextSnapshot(worksheet, item.id)
                setWorkspace(createWorkspace(item.id, snapshot, generation + 1))
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <div className="app__workspace">
        <section className="app__authoring" aria-label="Aktiver Arbeitsbereich">
          <Editor key={generation} worksheet={worksheet} name="Editor 1" />
        </section>
        <aside className="app__preview" aria-label="Dokumente">
          <Documents key={generation} worksheet={worksheet} />
        </aside>
      </div>
    </main>
  )
}

function Documents({ worksheet }: { worksheet: EditorWorksheet }) {
  useSyncExternalStore(worksheet.subscribe, worksheet.getRevision, worksheet.getRevision)
  return (
    <section className="documents">
      <h2>Inhalt · Antworten · Feedback</h2>
      <p>Beim Moduswechsel: Snapshot → neuer Store → neues Arbeitsblatt → neuer Editor.</p>
      <dl className="document-status">
        <dt>Inhalt</dt>
        <dd>{documentStatus(worksheet.mode === WorksheetMode.EditingContent)}</dd>
        <dt>Antworten</dt>
        <dd>{documentStatus(worksheet.mode === WorksheetMode.Answering)}</dd>
        <dt>Feedback</dt>
        <dd>{documentStatus(worksheet.mode === WorksheetMode.GivingFeedback)}</dd>
      </dl>
      <p className="documents__note">
        Nur aktueller Modus ist bearbeitbar. Zurück zum Inhalt löscht Antworten und Feedback; zurück
        zu Aufgaben löscht Feedback.
      </p>
      <DocumentJSON label="Inhalt" snapshot={worksheet.content.snapshot()} />
      <DocumentJSON label="Antworten" snapshot={worksheet.answers.snapshot()} />
      <DocumentJSON label="Feedback" snapshot={worksheet.feedbacks.snapshot()} />
      <p className="documents__note">
        Debug-Ansicht enthält auch Lösungen. Schreibschutz ist keine Zugriffskontrolle.
      </p>
    </section>
  )
}

function documentStatus(editable: boolean) {
  return editable ? "Bearbeitbar" : "Schreibgeschützt"
}

function DocumentJSON({ label, snapshot }: { label: string; snapshot: unknown }) {
  return (
    <details className="document-json">
      <summary>{label} · JSON</summary>
      <pre>{JSON.stringify(snapshot, null, 2)}</pre>
    </details>
  )
}
