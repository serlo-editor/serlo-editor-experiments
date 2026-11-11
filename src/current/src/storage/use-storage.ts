import { useCallback, useSyncExternalStore } from "react"

import type { NodeStore } from "./storage/types"

// ponytail: document-wide invalidation; split subscriptions only if render cost warrants it.
export function useStorage(store?: Pick<NodeStore, "subscribe" | "getRevision">) {
  const subscribe = useCallback(
    (listener: () => void) => store?.subscribe(listener) ?? (() => {}),
    [store],
  )
  const getRevision = useCallback(() => store?.getRevision() ?? 0, [store])
  return useSyncExternalStore(subscribe, getRevision, getRevision)
}
