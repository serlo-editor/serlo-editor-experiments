import { useEffect, useState } from "react"
import { Awareness } from "y-protocols/awareness"
import * as Y from "yjs"

import { Root, type RootSnapshot } from "../editor/blocks"
import { Answers, Feedback } from "../editor/blocks/responses"
import { YjsNodeStore } from "../editor/store"
import { useStorage } from "../editor/store/use-storage"
import { openWorksheet, WorksheetMode } from "../editor/worksheet"
import {
  WorksheetEditor,
  type EditorWorksheet,
} from "../editor/worksheet/authoring/WorksheetEditor"
import { initialContent } from "./initial-content"
import { syncPeers } from "./sync-peers"

import styles from "./App.module.css"

const modes = [
  { id: WorksheetMode.EditingContent, label: "1. Inhalt bearbeiten" },
  { id: WorksheetMode.Answering, label: "2. Aufgaben lösen" },
  { id: WorksheetMode.GivingFeedback, label: "3. Feedback geben" },
  { id: WorksheetMode.ViewingFeedback, label: "4. Feedback ansehen" },
]

type Snapshot = {
  content: RootSnapshot
  answers: ReturnType<typeof Answers.defaultValue>
  feedbacks: ReturnType<typeof Feedback.defaultValue>
}
type Peer = {
  doc: Y.Doc
  awareness: Awareness
  store: YjsNodeStore
  worksheet: EditorWorksheet
  destroy(): void
}
type Workspace = { first: Peer; second: Peer; generation: number; destroy(): void }

function createWorkspace(mode: WorksheetMode, snapshot: Snapshot, generation: number): Workspace {
  const first = createPeer(mode, snapshot, "Editor 1", "#2563eb")
  try {
    const second = createPeer(
      mode,
      snapshot,
      "Editor 2",
      "#b45309",
      Y.encodeStateAsUpdate(first.doc),
    )
    const disconnect = syncPeers(first, second)
    return {
      first,
      second,
      generation,
      destroy() {
        disconnect()
        first.destroy()
        second.destroy()
      },
    }
  } catch (error) {
    first.destroy()
    throw error
  }
}

function createPeer(
  mode: WorksheetMode,
  snapshot: Snapshot,
  name: string,
  color: string,
  state?: Uint8Array,
): Peer {
  const doc = new Y.Doc()
  const awareness = new Awareness(doc)
  try {
    if (state) Y.applyUpdate(doc, state)
    awareness.setLocalStateField("user", { name, color })
    const store = new YjsNodeStore({ doc, awareness, storeName: mode })
    const worksheet = openWorksheet({
      mode,
      createStore: () => store,
      contentSchema: Root,
      answersSchema: Answers,
      feedbacksSchema: Feedback,
      initialSnapshot: snapshot,
    })
    return {
      doc,
      awareness,
      store,
      worksheet,
      destroy() {
        worksheet.dispose()
        awareness.destroy()
        doc.destroy()
      },
    }
  } catch (error) {
    awareness.destroy()
    doc.destroy()
    throw error
  }
}

function nextSnapshot(worksheet: EditorWorksheet, mode: WorksheetMode): Snapshot {
  const content = worksheet.content.snapshot()
  const answers = mode === WorksheetMode.EditingContent ? {} : worksheet.answers.snapshot()
  const feedbacks =
    mode === WorksheetMode.EditingContent || mode === WorksheetMode.Answering
      ? {}
      : worksheet.feedbacks.snapshot()
  return { content, answers, feedbacks }
}

export default function App() {
  const [workspace, setWorkspace] = useState(() =>
    createWorkspace(
      WorksheetMode.EditingContent,
      { content: initialContent, answers: {}, feedbacks: {} },
      0,
    ),
  )
  const [rightPane, setRightPane] = useState<"documents" | "collaboration">("collaboration")
  useEffect(() => () => workspace.destroy(), [workspace])
  const { first, second, generation } = workspace
  const { worksheet, store } = first
  return (
    <main className={styles.app}>
      <header className={styles.header}>
        <h1>Ein Arbeitsblatt · drei Dokumente</h1>
        <div className={styles.headerControls}>
          <nav className={styles.viewSwitch} aria-label="Arbeitsmodus">
            {modes.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={worksheet.mode === item.id}
                onClick={() => {
                  if (item.id === worksheet.mode) return
                  setWorkspace(
                    createWorkspace(item.id, nextSnapshot(worksheet, item.id), generation + 1),
                  )
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className={styles.viewSwitch} role="group" aria-label="Rechter Bereich">
            <button
              type="button"
              aria-pressed={rightPane === "documents"}
              onClick={() => setRightPane("documents")}
            >
              Dokument
            </button>
            <button
              type="button"
              aria-pressed={rightPane === "collaboration"}
              onClick={() => setRightPane("collaboration")}
            >
              Zusammenarbeit
            </button>
          </div>
        </div>
      </header>
      <div className={styles.workspace}>
        <section className={styles.authoring} aria-label="Aktiver Arbeitsbereich">
          <WorksheetEditor
            key={generation}
            worksheet={worksheet}
            store={store}
            name="Editor 1"
            color="#2563eb"
          />
        </section>
        <aside
          className={`${styles.preview} ${rightPane === "collaboration" ? styles.collaboration : ""}`}
          aria-label="Zusammenarbeit und Dokumente"
        >
          <div hidden={rightPane !== "collaboration"}>
            <WorksheetEditor
              key={generation}
              worksheet={second.worksheet}
              store={second.store}
              name="Editor 2"
              color="#b45309"
            />
          </div>
          <div hidden={rightPane !== "documents"}>
            <Documents key={generation} worksheet={worksheet} store={store} />
          </div>
        </aside>
      </div>
    </main>
  )
}

function Documents({ worksheet, store }: { worksheet: EditorWorksheet; store: YjsNodeStore }) {
  useStorage(store)
  return (
    <section className={styles.documents}>
      <h2>Inhalt · Antworten · Feedback</h2>
      <p>Beim Moduswechsel: Snapshot → neue Yjs-Dokumente → neue Editoren.</p>
      <dl className={styles.status}>
        <dt>Inhalt</dt>
        <dd>{documentStatus(worksheet.mode === WorksheetMode.EditingContent)}</dd>
        <dt>Antworten</dt>
        <dd>{documentStatus(worksheet.mode === WorksheetMode.Answering)}</dd>
        <dt>Feedback</dt>
        <dd>{documentStatus(worksheet.mode === WorksheetMode.GivingFeedback)}</dd>
      </dl>
      <p className={styles.note}>
        Nur aktueller Modus ist bearbeitbar. Zurück zum Inhalt löscht Antworten und Feedback; zurück
        zu Aufgaben löscht Feedback.
      </p>
      <DocumentJSON label="Inhalt" snapshot={worksheet.content.snapshot()} />
      <DocumentJSON label="Antworten" snapshot={worksheet.answers.snapshot()} />
      <DocumentJSON label="Feedback" snapshot={worksheet.feedbacks.snapshot()} />
      <p className={styles.note}>
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
    <details className={styles.json}>
      <summary>{label} · JSON</summary>
      <pre>{JSON.stringify(snapshot, null, 2)}</pre>
    </details>
  )
}
