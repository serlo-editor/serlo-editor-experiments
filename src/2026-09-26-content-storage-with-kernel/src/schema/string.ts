import type { Handle, Schema } from "./types.ts"

export interface StringHandle extends Handle<string> {
  get(): string
  set(value: string): void
}

export function string(): Schema<string, StringHandle, "cell"> {
  return {
    create(store, snapshot) {
      return store.cell.create(snapshot)
    },

    bind(store, ref) {
      const read = (): string => {
        const value = store.cell.get(ref)
        if (typeof value !== "string") {
          throw new TypeError("Expected string cell.")
        }
        return value
      }

      return {
        get: read,
        snapshot: read,

        set(value) {
          store.transact((tx) => {
            store.cell.edit(ref, tx).set(value)
          })
        },
      }
    },
  }
}
