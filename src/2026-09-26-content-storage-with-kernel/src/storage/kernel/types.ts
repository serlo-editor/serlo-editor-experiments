export interface StoreKernel<Location> {
  readonly boolean: ScalarKernel<boolean, Location>
  readonly number: ScalarKernel<number, Location>
  readonly string: ScalarKernel<string, Location>
}

export interface ScalarKernel<Value extends boolean | number | string, Location> {
  create(value: Value, location: Location): StoreRef<Value, Location>
  get(ref: StoreRef<Value, Location>): Value
  set(ref: StoreRef<Value, Location>, value: Value): void
}

export interface StoreRef<Value, Location> {
  readonly location: Location
  // Phantom type links this location to Value without storing a runtime value copy.
  // Function property makes Value invariant under strictFunctionTypes, preventing
  // widening writable references (e.g. string to string | number) and unsafe writes.
  readonly [storedValue]: (value: Value) => Value
}

declare const storedValue: unique symbol
