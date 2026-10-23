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
      {sessions ? <PrototypeDemo sessions={sessions} /> : "Loading…"}
    </main>
  )
}

export function PrototypeDemo({
  sessions,
}: {
  sessions: ReturnType<typeof createPrototypeSessions>
}) {
  const [selection, setSelection] = useState<LocalSelection | null>(null)
  const reportSelection = useCallback((next: LocalSelection | null) => {
    setSelection((previous) =>
      JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
    )
  }, [])

  return (
    <>
      <section className="app__editors">
        <SelectionContext value={reportSelection}>
          <SessionPane session={sessions.first} />
        </SelectionContext>
        <SessionPane session={sessions.second} />
      </section>
      <section className="app__debug panel">
        <EditorDebugPanel session={sessions.first} selection={selection} />
      </section>
    </>
  )
}

export function SessionPane({ session }: { session: PrototypeSession }) {
  // ponytail: rerender whole session; add per-unit subscriptions only if documents outgrow this demo.
  useStorageRevision(session.store)
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
          <UnitView handle={session.document.root} />
        </div>
      </section>
    </div>
  )
}
