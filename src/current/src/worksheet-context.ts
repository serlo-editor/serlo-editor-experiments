import { createContext, useContext } from "react"

import type { StoredValue } from "./schema/types.ts"
import type { Worksheet } from "./worksheet"

/** Concrete record schemas stay with app setup; context exposes ID lookups. */
type RecordLookup = StoredValue & { get(id: string): unknown }
type WorksheetContextValue = Worksheet<StoredValue, RecordLookup, RecordLookup>

export const WorksheetContext = createContext<WorksheetContextValue | null>(null)

export function useWorksheet(): WorksheetContextValue {
  const worksheet = useContext(WorksheetContext)
  if (!worksheet) throw new Error("Worksheet provider missing.")
  return worksheet
}
