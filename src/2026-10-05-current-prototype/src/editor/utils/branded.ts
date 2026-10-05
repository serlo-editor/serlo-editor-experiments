export type Branded<T, B> = T & { [brandedSymbol]: B }

declare const brandedSymbol: unique symbol
