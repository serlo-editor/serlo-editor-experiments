import type { Awareness } from "y-protocols/awareness"
import type { Doc } from "yjs"

export interface CDRT {
  name: string
  doc: Doc
  awareness: Awareness
  color: string
}
