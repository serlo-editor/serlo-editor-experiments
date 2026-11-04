import { createSession, type EditorSession } from "../editor"
import type { RootSnapshot } from "../editor/content"
import type { SyncBackend } from "../sync"
import { type ExerciseType, exerciseTypes } from "./initial-content"

/** Distinguishes peers of different tabs in remote cursors. */
const names = [
  "Eifrige Eule",
  "Engagierter Elefant",
  "Eloquenter Eisbär",
  "Kluger Kranich",
  "Kreative Krähe",
  "Weiser Wal",
  "Wissbegieriger Waschbär",
  "Fleißiger Fuchs",
  "Findige Fledermaus",
  "Gewissenhafte Giraffe",
  "Belesener Biber",
  "Besonnene Biene",
  "Pfiffiger Pinguin",
  "Tüchtiger Tiger",
  "Aufmerksamer Adler",
  "Lustiger Luchs",
  "Motivierte Möwe",
  "Neugieriges Nashorn",
  "Zielstrebiges Zebra",
]
// y-prosemirror needs 6-digit hex colors; it appends an alpha suffix for the selection highlight.
const colors = ["#2563eb", "#b45309", "#15803d", "#be185d", "#7c3aed", "#0e7490"]
const user = {
  name: pickRandom(names) ?? "Eifrige Eule",
  color: pickRandom(colors) ?? "#2563eb",
}

/** Long enough for a slow first connect, short enough to not stare at "Loading..." offline. */
const syncTimeoutMs = 8000

export type DemoSession = Awaited<ReturnType<typeof openDemoSession>>

/** Opens one room per exercise type; if any fails, the others are closed again. */
export async function openDemoSessions(
  backend: SyncBackend,
): Promise<Map<ExerciseType, DemoSession>> {
  const results = await Promise.allSettled(
    exerciseTypes.map(async ({ id, content }): Promise<[ExerciseType, DemoSession]> => [
      id,
      await openDemoSession(backend, `editor-demo:demo:${id}`, content),
    ]),
  )
  const opened = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
  const failure = results.find((result) => result.status === "rejected")
  if (failure) {
    for (const [, demo] of opened) demo.close()
    throw failure.reason
  }
  return new Map(opened)
}

/** Joins the room shared by all tabs; the first peer of an empty room seeds it. */
export async function openDemoSession(
  backend: SyncBackend,
  roomId: string,
  snapshot: RootSnapshot,
): Promise<{ session: EditorSession; close: () => void }> {
  const connection = backend.connect(roomId)
  try {
    // Seeding only after remote state is loaded keeps peers from creating competing roots.
    await withTimeout(connection.synced(), syncTimeoutMs, `Sync of ${roomId} timed out`)
    const session = createSession({
      user,
      doc: connection.doc,
      awareness: connection.awareness,
      snapshot,
    })
    return {
      session,
      close() {
        session.destroy()
        connection.disconnect()
      },
    }
  } catch (error) {
    connection.disconnect()
    throw error
  }
}

function pickRandom<T>(items: T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)]
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}
