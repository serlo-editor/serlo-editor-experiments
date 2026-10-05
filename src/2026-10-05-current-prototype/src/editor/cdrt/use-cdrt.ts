import { useMemo } from "react"
import { Awareness } from "y-protocols/awareness"
import { Doc } from "yjs"

import type { CDRT } from "./types"

export interface CDRTOptions {
  name: string
  color: string
}

export function useCDRT({ name, color }: CDRTOptions): CDRT {
  return useMemo(() => {
    const doc = new Doc()
    const awareness = new Awareness(doc)

    awareness.setLocalStateField("user", { name, color })

    return { name, doc, awareness, color }
  }, [name, color])
}
