import { useEffect, useState } from "react"

import { Editor } from "../editor"
import { initialContent } from "./initial-content"
import { Preview } from "./Preview"
import { createDemoSessions } from "./sessions"

export default function App() {
  const [sessions, setSessions] = useState<ReturnType<typeof createDemoSessions> | null>(null)
  const [previewVersion, resetPreview] = useState(0)
  const [rightPane, setRightPane] = useState<"preview" | "collaboration">("preview")

  useEffect(() => {
    const next = createDemoSessions(initialContent)
    setSessions(next)
    return () => next.destroy()
  }, [])

  if (!sessions) return <main className="app">Loading...</main>

  return (
    <main className="app">
      <header className="app__header">
        <h1>Editor für Lerninhalte</h1>
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
          <Editor session={sessions.first} />
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
            <Preview key={previewVersion} session={sessions.first} />
          </div>
          <div
            id="right-pane-collaboration"
            className="app__collaboration"
            hidden={rightPane !== "collaboration"}
          >
            <Editor session={sessions.second} />
          </div>
        </section>
      </div>
    </main>
  )
}
