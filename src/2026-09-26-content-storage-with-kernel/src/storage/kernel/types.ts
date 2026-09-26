export interface StoreKernel<Location, Destination> {
  readonly boolean: ScalarKernel<boolean, Location, Destination>
  readonly number: ScalarKernel<number, Location, Destination>
  readonly string: ScalarKernel<string, Location, Destination>
  readonly array: ArrayKernel<Location, Destination>
}

export interface ScalarKernel<Value extends boolean | number | string, Location, Destination> {
  initialize(destination: Destination, value: Value): StoreRef<Value, Location>
  get(ref: StoreRef<Value, Location>): Value
  set(ref: StoreRef<Value, Location>, value: Value): void
}

// Arrays contain child references; schemas own their interpretation and snapshots.
export interface ArrayKernel<Location, Destination> {
  initialize<Value>(
    destination: Destination,
    items: readonly StoreRef<Value, Location>[],
  ): StoreRef<Value[], Location>
  get<Value>(ref: StoreRef<Value[], Location>): readonly StoreRef<Value, Location>[]
  set<Value>(ref: StoreRef<Value[], Location>, items: readonly StoreRef<Value, Location>[]): void
}

export interface StoreRef<Value, Location> {
  readonly location: Location
  // Phantom type links this location to Value without storing a runtime value copy.
  // `storedValue` is a unique symbol to prevent accidental access and ensure type safety.
  //
  // Function property makes Value invariant under strictFunctionTypes, preventing
  // widening writable references (e.g. StoreRef<string> to
  // StoreRef<string | number>) and unsafe writes.
  readonly [storedValue]: (value: Value) => Value
}

declare const storedValue: unique symbol
