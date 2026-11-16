import {
  createContext,
  createElement,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react"

import type { Worksheet } from "./worksheet.ts"

export const WorksheetContext = createContext<Worksheet | null>(null)

export function WorksheetRevisionProvider({
  worksheet,
  children,
}: {
  worksheet: Worksheet
  children: ReactNode
}) {
  useSyncExternalStore(worksheet.subscribe, worksheet.getRevision, worksheet.getRevision)

  return createElement(WorksheetContext.Provider, { value: worksheet }, children)
}

export function useWorksheet(): Worksheet {
  const worksheet = useContext(WorksheetContext)
  if (!worksheet) throw new Error("Worksheet provider missing.")
  return worksheet
}
