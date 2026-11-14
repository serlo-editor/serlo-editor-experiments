import {
  createContext,
  createElement,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react"

import type { Worksheet } from "./worksheet.ts"

export const WorksheetContext = createContext<Worksheet | null>(null)
const WorksheetRevisionContext = createContext(0)

export function WorksheetRevisionProvider({
  worksheet,
  children,
}: {
  worksheet: Worksheet
  children: ReactNode
}) {
  const revision = useSyncExternalStore(
    worksheet.subscribe,
    worksheet.getRevision,
    worksheet.getRevision,
  )

  return createElement(
    WorksheetContext.Provider,
    { value: worksheet },
    createElement(WorksheetRevisionContext.Provider, { value: revision }, children),
  )
}

export function useWorksheet(): Worksheet {
  const worksheet = useContext(WorksheetContext)
  useContext(WorksheetRevisionContext)
  if (!worksheet) throw new Error("Worksheet provider missing.")
  return worksheet
}
