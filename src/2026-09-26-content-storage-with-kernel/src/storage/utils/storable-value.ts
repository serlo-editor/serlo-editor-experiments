/**
 * Values that storage can persist.
 *
 * Supports JSON-like scalar values, readonly arrays, and readonly string-keyed
 * objects. Array and object contents are intentionally not constrained here;
 * their schemas belong to the storage layer using this type.
 */
export type StorableValue =
  | readonly unknown[]
  | { readonly [key: string]: unknown }
  | null
  | string
  | number
  | boolean
