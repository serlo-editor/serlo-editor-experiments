import { useEffect, useState } from "react"

import type { EditorSession } from "../editor"

export interface Viewer {
  clientId: number
  name: string
  color: string
}

/**
 * Every tab is connected to all rooms at once, so presence alone doesn't tell where a
 * peer is. Each tab therefore flags the room it currently shows as `viewing`.
 */
export function useViewers<Key>(
  sessions: Map<Key, EditorSession> | null,
  active: Key,
): Map<Key, Viewer[]> {
  const [viewers, setViewers] = useState(() => new Map<Key, Viewer[]>())

  useEffect(() => {
    if (!sessions) return
    for (const [key, session] of sessions) {
      session.awareness.setLocalStateField("viewing", key === active)
    }
  }, [sessions, active])

  useEffect(() => {
    if (!sessions) return
    const update = () =>
      setViewers(new Map([...sessions].map(([key, session]) => [key, remoteViewers(session)])))
    update()
    for (const session of sessions.values()) session.awareness.on("change", update)
    return () => {
      for (const session of sessions.values()) session.awareness.off("change", update)
    }
  }, [sessions])

  return viewers
}

function remoteViewers(session: EditorSession): Viewer[] {
  return [...session.awareness.getStates()].flatMap(([clientId, state]) =>
    clientId !== session.doc.clientID && isViewing(state)
      ? [{ clientId, name: state.user.name, color: state.user.color }]
      : [],
  )
}

function isViewing(
  state: unknown,
): state is { viewing: true; user: { name: string; color: string } } {
  if (typeof state !== "object" || state === null) return false
  if (!("viewing" in state) || state.viewing !== true || !("user" in state)) return false
  const { user } = state
  return (
    typeof user === "object" &&
    user !== null &&
    "name" in user &&
    typeof user.name === "string" &&
    "color" in user &&
    typeof user.color === "string"
  )
}
