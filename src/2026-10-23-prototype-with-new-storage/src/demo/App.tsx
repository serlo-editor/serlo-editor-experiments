import { useCallback, useEffect, useState } from "react"

import { UnitView } from "../editor/schema/index.ts"
import { EditorDebugPanel } from "./DebugPanel.tsx"
import { type LocalSelection, SelectionContext } from "./RichTextField.tsx"
import { createPrototypeSessions, type PrototypeSession, useStorageRevision } from "./session.ts"

export default function App() {
  const [sessions, setSessions] = useState<ReturnType<typeof createPrototypeSessions> | null>(null)
  useEffect(() => {
    const pair = createPrototypeSessions()
    setSessions(pair)
    return () => pair.destroy()
  }, [])

  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">Prototype: Collaborative unit editing</h1>
      </header>
      <section className="app__editors">
        {sessions ? (
          <>
            <SessionPane session={sessions.first} />
            <SessionPane session={sessions.second} />
          </>
        ) : (
          "Loading…"
        )}
      </section>
    </main>
  )
}

export function SessionPane({ session }: { session: PrototypeSession }) {
  // ponytail: rerender whole session; add per-unit subscriptions only if documents outgrow this demo.
  useStorageRevision(session.store)
  const [selection, setSelection] = useState<LocalSelection | null>(null)
  const reportSelection = useCallback((next: LocalSelection | null) => {
    setSelection((previous) =>
      JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
    )
  }, [])

  return (
    <div className="app__session">
      <section className="editor-card panel" aria-label={session.name}>
        <h2 className="editor-card__title">
          <span
            className="editor-card__accent"
            style={{ backgroundColor: session.color }}
            aria-hidden="true"
          />
          {session.name}
        </h2>
        <div className="editor-frame surface">
          <SelectionContext value={reportSelection}>
            <UnitView handle={session.document.root} />
          </SelectionContext>
        </div>
      </section>
      <section className="app__debug panel">
        <EditorDebugPanel session={session} selection={selection} />
      </section>
    </div>
  )
}
