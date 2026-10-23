import { useRef, useSyncExternalStore } from "react"

import type { CDRT } from "../cdrt/types"
import { EditorStore } from "./editor-store"

const stores = new WeakMap<CDRT, EditorStore>()

export function useEditorStore(cdrt: CDRT) {
  const store = getChachedStore(cdrt)

  const lastReturn = useRef({ store, updateCount: store.updateCount })

  return useSyncExternalStore(
    (listener) => store.addUpdateListener(listener),
    () => {
      if (lastReturn.current.updateCount === store.updateCount) {
        return lastReturn.current
      }

      lastReturn.current = { store, updateCount: store.updateCount }

      return lastReturn.current
    },
  )
}

function getChachedStore(cdrt: CDRT) {
  const store = stores.get(cdrt)

  if (store != null) {
    return store
  } else {
    const store = new EditorStore(cdrt)
    stores.set(cdrt, store)
    return store
  }
}
