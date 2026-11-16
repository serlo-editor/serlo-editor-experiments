import { useSyncExternalStore } from "react"

import { BlockView } from "../schema"
import type { EditorSession } from "../session"
import { ARROW_NAV_ATTRIBUTE, handleArrowKeyNavigation } from "./arrow-navigation"

export function Editor({ session }: { session: EditorSession }) {
  useSyncExternalStore(
    session.store.subscribe.bind(session.store),
    session.store.getRevision.bind(session.store),
  )
  return (
    <form
      className="editor-card panel"
      aria-label={session.name}
      onSubmit={(event) => event.preventDefault()}
      onKeyDown={handleArrowKeyNavigation}
      {...{ [ARROW_NAV_ATTRIBUTE]: "" }}
    >
      <section className="editor-frame">
        <div className="editor-content">
          {session.root.map((value) => (
            <BlockView key={value.id} value={value} />
          ))}
        </div>
      </section>
    </form>
  )
}
