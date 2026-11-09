import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react"

import {
  Editor,
  WorksheetMode,
  initialWorksheetSnapshot,
  type EditorHandle,
  type WorksheetSnapshot,
} from "../editor"
import { initialContent } from "./initial-content"
import { createDemoSessions, type DemoSessions, type EditorSession } from "./sessions"

const modes: { id: WorksheetMode; label: string }[] = [
  { id: WorksheetMode.EditingContent, label: "1. Inhalt bearbeiten" },
  { id: WorksheetMode.Answering, label: "2. Aufgaben lösen" },
  { id: WorksheetMode.GivingFeedback, label: "3. Feedback geben" },
  { id: WorksheetMode.ViewingFeedback, label: "4. Feedback ansehen" },
]

interface Workspace {
  sessions: DemoSessions
  mode: WorksheetMode
  snapshot: WorksheetSnapshot
}

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>(() => ({
    sessions: createDemoSessions(),
    mode: WorksheetMode.EditingContent,
    snapshot: initialWorksheetSnapshot(initialContent),
  }))
  const firstRef = useRef<EditorHandle>(null)
  const secondRef = useRef<EditorHandle>(null)
  const [rightPane, setRightPane] = useState<"documents" | "collaboration">("collaboration")
  useEffect(() => () => workspace.sessions.destroy(), [workspace.sessions])

  const { sessions, mode, snapshot } = workspace
  function switchMode(next: WorksheetMode) {
    if (next === mode) return
    const current = firstRef.current?.snapshot() ?? snapshot
    setWorkspace({ sessions: createDemoSessions(), mode: next, snapshot: current })
  }

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
                onClick={() => switchMode(item.id)}
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
            ref={firstRef}
            mode={mode}
            snapshot={snapshot}
            store={sessions.first.store}
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
              ref={secondRef}
              mode={mode}
              snapshot={snapshot}
              store={sessions.second.store}
              name={sessions.second.name}
              color={sessions.second.color}
            />
          </div>
          {rightPane === "documents" && (
            <Documents mode={mode} snapshot={snapshot} editor={firstRef} session={sessions.first} />
          )}
        </aside>
      </div>
    </main>
  )
}

function Documents({
  mode,
  snapshot,
  editor,
  session,
}: {
  mode: WorksheetMode
  snapshot: WorksheetSnapshot
  editor: RefObject<EditorHandle | null>
  session: EditorSession
}) {
  useSyncExternalStore(
    (listener) => session.store.subscribe(listener),
    () => session.store.getRevision(),
  )
  const current = editor.current?.snapshot() ?? snapshot
  return (
    <section className="documents">
      <h2>Arbeitsblatt-Snapshot</h2>
      <p>
        Jeder Modus erstellt zwei neue, synchronisierte Yjs-Editoren aus dem aktuellen Snapshot.
      </p>
      <dl className="document-status">
        <dt>Inhalt</dt>
        <dd>{documentStatus(mode === WorksheetMode.EditingContent)}</dd>
        <dt>Antworten</dt>
        <dd>{documentStatus(mode === WorksheetMode.Answering)}</dd>
        <dt>Feedback</dt>
        <dd>{documentStatus(mode === WorksheetMode.GivingFeedback)}</dd>
      </dl>
      <p className="documents__note">
        Nur das Dokument des aktuellen Modus ist bearbeitbar. Beim Wechsel bleiben alle drei
        Dokumente erhalten; die anderen sind unveränderliche Snapshots.
      </p>
      <DocumentJSON label="Inhalt" value={current.content} />
      <DocumentJSON label="Antworten" value={current.answers} />
      <DocumentJSON label="Feedback" value={current.feedback} />
      <p className="documents__note">
        Debug-Ansicht enthält auch Lösungen. Schreibschutz ist keine Zugriffskontrolle.
      </p>
    </section>
  )
}

function documentStatus(editable: boolean) {
  return editable ? "Yjs · bearbeitbar" : "Snapshot · schreibgeschützt"
}

function DocumentJSON({ label, value }: { label: string; value: unknown }) {
  return (
    <details className="document-json">
      <summary>{label} · JSON</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  )
}
