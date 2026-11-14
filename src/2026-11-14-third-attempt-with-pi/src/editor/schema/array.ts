import type { AnySchema, Schema, SnapshotOf, StoredValue, StoredValueOf } from "./types.ts"

export interface StoredArray<ChildSchema extends AnySchema> extends StoredValue<
  readonly SnapshotOf<ChildSchema>[]
> {
  readonly length: number
  children(): StoredValueOf<ChildSchema>[]
  map<Result>(callback: (child: StoredValueOf<ChildSchema>, index: number) => Result): Result[]
  remove(index: number): void
  insert(index: number, value: SnapshotOf<ChildSchema>): void
}

export function array<ChildSchema extends AnySchema>(
  childSchema: ChildSchema,
  { defaultLength = 1 }: { defaultLength?: number } = {},
): Schema<readonly SnapshotOf<ChildSchema>[], StoredArray<ChildSchema>, "array"> {
  if (!Number.isSafeInteger(defaultLength) || defaultLength < 0) {
    throw new RangeError("Expected a non-negative integer array default length.")
  }

  return {
    defaultValue: () => Array.from({ length: defaultLength }, () => childSchema.defaultValue()),

    create(store, snapshots) {
      const refs = snapshots.map((snapshot) => childSchema.create(store, snapshot))
      return store.array.create(refs)
    },

    bind(store, ref) {
      const children = () =>
        store.array.get(ref).map((childRef) => childSchema.bind(store, childRef))

      return {
        get length() {
          return store.array.get(ref).length
        },

        children,

        map(callback) {
          return children().map((child, index) => callback(child, index))
        },

        remove(index) {
          store.transact((write) => write.array.remove(ref, index))
        },

        insert(index, snapshot) {
          const childRef = childSchema.create(store, snapshot)
          store.transact((write) => write.array.insert(ref, index, childRef))
        },

        snapshot() {
          return children().map((child) => child.snapshot())
        },
      }
    },
  }
}
