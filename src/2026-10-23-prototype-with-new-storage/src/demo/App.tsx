import { useEffect } from "react"

import { Editor, useCDRT } from "../editor"
import { EditorDebugPanel } from "./DebugPanel"
import { initialContent } from "./initial-content"
import { syncCDRTs } from "./sync-cdrts"

export default function App() {
  const cdrt1 = useCDRT({ name: "Editor 1", color: "#2563eb" })
  const cdrt2 = useCDRT({ name: "Editor 2", color: "#b45309" })

  useEffect(() => syncCDRTs(cdrt1, cdrt2), [cdrt1, cdrt2])

  return (
    <main className="app">
      <header className="app__header">
        <h1 className="app__title">Prototype: Collaborative editing</h1>
      </header>

      <section className="app__editors">
        <Editor key={cdrt1.name} cdrt={cdrt1} initialContent={initialContent} />
        <Editor key={cdrt2.name} cdrt={cdrt2} />
      </section>

      <section className="app__debug panel">
        <EditorDebugPanel cdrt={cdrt1} />
      </section>
    </main>
  )
}
