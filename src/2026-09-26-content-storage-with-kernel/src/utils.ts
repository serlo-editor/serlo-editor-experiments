export type Branded<T, B extends symbol> = T & { readonly [K in B]: true }
