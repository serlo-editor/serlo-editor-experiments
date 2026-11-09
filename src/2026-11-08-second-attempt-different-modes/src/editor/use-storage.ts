import { useCallback, useSyncExternalStore } from "react"

import type { NodeStore } from "./storage"

export function useStorage(store: Pick<NodeStore, "subscribe" | "getRevision">) {
  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store])
  const getRevision = useCallback(() => store.getRevision(), [store])
  return useSyncExternalStore(subscribe, getRevision, getRevision)
}
