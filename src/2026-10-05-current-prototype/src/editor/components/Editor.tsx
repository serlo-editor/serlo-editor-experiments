import type { CSSProperties } from "react"
import { useEffect } from "react"

import type { CDRT } from "../cdrt/types"
import { Root } from "../content"
import { render } from "../operations/render"
import { saveRoot } from "../operations/save"
import type { JSONValue } from "../schema"
import type { Key } from "../store/key"
import { useEditorStore } from "../store/use-editor-store"
import { Toolbar } from "./Toolbar"

const ROOT_KEY = "root" as Key

interface EditorProps {
  cdrt: CDRT
  initialContent?: JSONValue<Root>
}

export function Editor({ cdrt, initialContent }: EditorProps) {
  const { store } = useEditorStore(cdrt)

  useEffect(() => {
    if (initialContent == null || store.has(ROOT_KEY)) return

    store.update((tx) => {
      const rootNode = { schema: Root, value: initialContent }

      saveRoot({ tx, rootKey: ROOT_KEY, node: rootNode })
    })
  }, [store, initialContent])

  return (
    <form className="editor-card panel" aria-label={cdrt.name}>
      <h2 className="editor-card__title">
        <span
          className="editor-card__accent"
          style={{ "--accent-color": cdrt.color } as CSSProperties}
          aria-hidden="true"
        />{" "}
        {cdrt.name}
      </h2>

      <section className="editor-frame surface">
        <div className="editor-toolbar-shell">
          <Toolbar store={store} />
        </div>
        {store.has(ROOT_KEY) ? render({ store, node: store.get(ROOT_KEY) }) : "Loading..."}
      </section>
    </form>
  )
}
