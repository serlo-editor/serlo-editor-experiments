import { defineSchema } from "./define-schema.ts"
import type { Schema, SnapshotHandle } from "./types.ts"

export interface StringHandle extends SnapshotHandle<string> {
  get(): string
  set(value: string): void
}

export function string(): Schema<string, StringHandle, "cell"> {
  return defineSchema<string, StringHandle, "cell">({
    create(ctx, snapshot) {
      return ctx.store.cell.create(snapshot)
    },

    bind(ctx, ref) {
      const read = () => ctx.store.cell.get(ref)

      return {
        get: read,
        snapshot: read,

        set(value) {
          ctx.store.transact((tx) => {
            ctx.store.cell.edit(ref, tx).set(value)
          })
        },
      }
    },
  })
}
