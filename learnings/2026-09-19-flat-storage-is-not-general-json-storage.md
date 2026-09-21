# Flat Storage Is Not General JSON Storage

## Context

`src/2026-09-19-flatstorage-test/` explores a flat storage abstraction that could serve both Yjs and ordinary flat storage.

## Learning

Yjs operates one level above flat storage. Its API stores and retrieves JSON structures rather than individual flat values. Therefore, this abstraction is a useful foundation for a flat JSON store or class used underneath one, but not a good basis for the overall JSON storage API.

The storage layer should expose JSON-level operations, with flat node storage kept as an implementation detail.

## Flat storage API

The experiment exposes typed references to flat values:

```ts
interface FlatNodeReference<Kind extends FlatNodeKind = FlatNodeKind> {
  kind: Kind
  key: string
}

interface FlatNodeValues {
  string: string
  number: number
  boolean: boolean
  array: FlatNodeReference[]
  object: Record<string, FlatNodeReference | undefined>
}

type FlatNodeKind = keyof FlatNodeValues

type FlatNodeValue<Kind extends FlatNodeKind> = FlatNodeValues[Kind]

class FlatStorage {
  create<Kind extends FlatNodeKind>(
    kind: Kind,
    value: FlatNodeValue<Kind>,
  ): FlatNodeReference<Kind>

  get<Kind extends FlatNodeKind>(
    reference: FlatNodeReference<Kind>,
  ): FlatNodeValue<Kind>

  update<Kind extends FlatNodeKind>(
    reference: FlatNodeReference<Kind>,
    value:
      | FlatNodeValue<Kind>
      | ((currentValue: FlatNodeValue<Kind>) => FlatNodeValue<Kind>),
  ): void
}
```

`create()` generates a kind-prefixed key and stores the value. `get()` retrieves it and throws when reference cannot be found. `update()` replaces value or derives new value from current value. `Buckets` provides private kind-specific `Map` instances; callers cannot access buckets directly.
