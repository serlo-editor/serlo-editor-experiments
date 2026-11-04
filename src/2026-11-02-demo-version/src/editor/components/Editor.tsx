import { UnitView } from "../schema"
import type { EditorSession } from "../session"
import { useStorage } from "../use-storage"
import { ARROW_NAV_ATTRIBUTE, handleArrowKeyNavigation } from "./arrow-navigation"

export function Editor({
  session,
  showName = true,
}: {
  session: EditorSession
  /** the peer's name only matters while collaborating */
  showName?: boolean
}) {
  useStorage(session.store)

  return (
    <form
      className="editor-card panel"
      aria-label={session.name}
      onSubmit={(event) => event.preventDefault()}
      onKeyDown={handleArrowKeyNavigation}
      {...{ [ARROW_NAV_ATTRIBUTE]: "" }}
    >
      {showName ? (
        <h2 className="editor-card__title">
          <span
            className="editor-card__accent"
            style={{ backgroundColor: session.color }}
            aria-hidden="true"
          />{" "}
          {session.name}
        </h2>
      ) : null}
      <section className="editor-frame">
        <div className="editor-content">
          {session.document.root.map((handle) => (
            <UnitView key={handle.id} handle={handle} />
          ))}
        </div>
      </section>
    </form>
  )
}
