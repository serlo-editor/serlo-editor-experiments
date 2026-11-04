import { createContext, useContext } from "react"

import type { WorksheetDocuments } from "./worksheet"

export const WorksheetContext = createContext<WorksheetDocuments | null>(null)

export function useWorksheet(): WorksheetDocuments {
  const worksheet = useContext(WorksheetContext)
  if (!worksheet) throw new Error("Worksheet provider missing.")
  return worksheet
}
