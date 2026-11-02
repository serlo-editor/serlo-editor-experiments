import { useSyncExternalStore } from "react"

import type { NodeStore } from "./storage/types"

// ponytail: document-wide invalidation; split subscriptions only if render cost warrants it.
export function useStorage(store: Pick<NodeStore, "subscribe" | "getRevision">) {
  return useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getRevision(),
  )
}
