export type Branded<T, B extends PropertyKey> = T & { readonly [K in B]: true }
