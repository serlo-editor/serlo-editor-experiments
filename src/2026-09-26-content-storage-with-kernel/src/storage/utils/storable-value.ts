export type StorableValue =
  | readonly unknown[]
  | { readonly [key: string]: unknown }
  | null
  | string
  | number
  | boolean
