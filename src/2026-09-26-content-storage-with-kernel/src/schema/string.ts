import { defineSchema } from "./define-schema.ts"
import type { Handle, Schema } from "./types.ts"

export interface StringHandle extends Handle<string> {
  get(): string
  set(value: string): void
}

export function string(): Schema<string, StringHandle, "cell"> {
  return defineSchema<string, StringHandle, "cell">({
    create(ctx, snapshot) {
      return ctx.store.cell.create(snapshot)
    },

    bind(ctx, ref) {
      const read = (): string => {
        const value = ctx.store.cell.get(ref)
        if (typeof value !== "string") {
          throw new TypeError("Expected string cell.")
        }
        return value
      }

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
