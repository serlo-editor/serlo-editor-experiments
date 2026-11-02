import { createSession, type EditorSession } from "../editor"
import type { RootSnapshot } from "../editor/content"
import type { SyncBackend } from "../sync"

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

export type DemoSession = Awaited<ReturnType<typeof openDemoSession>>

/** Joins the room shared by all tabs; the first peer of an empty room seeds it. */
export async function openDemoSession(
  backend: SyncBackend,
  roomId: string,
  snapshot: RootSnapshot,
): Promise<{ session: EditorSession; close: () => void }> {
  const connection = backend.connect(roomId)
  try {
    // Seeding only after remote state is loaded keeps peers from creating competing roots.
    await connection.synced()
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
