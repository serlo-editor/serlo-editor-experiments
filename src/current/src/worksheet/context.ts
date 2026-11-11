import { createContext, useContext } from "react"

import type { Worksheet } from "./index.ts"

export const WorksheetContext = createContext<Worksheet | null>(null)

export function useWorksheet(): Worksheet {
  const worksheet = useContext(WorksheetContext)
  if (!worksheet) throw new Error("Worksheet provider missing.")
  return worksheet
}
