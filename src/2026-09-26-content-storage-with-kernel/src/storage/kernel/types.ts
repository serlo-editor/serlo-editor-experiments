export interface StoreKernel<Location, Destination> {
  readonly cell: CellKernel<Location, Destination>
  readonly array: ArrayKernel<Location, Destination>
  readonly map: MapKernel<Location, Destination>
}

export interface CellKernel<Location, Destination> {
  create<Value>(destination: Destination, value: Value): CellRef<Value, Location>
  get<Value>(ref: CellRef<Value, Location>): Value
  set<Value>(ref: CellRef<Value, Location>, value: Value): void
}

// Arrays contain references to values created by the kernel.
export interface ArrayKernel<Location, Destination> {
  create(destination: Destination, items: readonly StoreRef<Location>[]): ArrayRef<Location>
  get(ref: ArrayRef<Location>): readonly StoreRef<Location>[]
  set(ref: ArrayRef<Location>, items: readonly StoreRef<Location>[]): void
}

export interface MapKernel<Location, Destination> {
  create(
    destination: Destination,
    fields: Readonly<Record<string, StoreRef<Location>>>,
  ): MapRef<Location>
  get(ref: MapRef<Location>): Readonly<Record<string, StoreRef<Location>>>
  set(ref: MapRef<Location>, fields: Readonly<Record<string, StoreRef<Location>>>): void
}

// A reference describes both where a value lives and what kind of value it is.
export interface CellRef<Value, Location> {
  readonly kind: "cell"
  readonly location: Location
  readonly [cellValueType]: (value: Value) => Value
}

export interface ArrayRef<Location> {
  readonly kind: "array"
  readonly location: Location
}

export interface MapRef<Location> {
  readonly kind: "map"
  readonly location: Location
}

export type StoreRef<Location> = CellRef<any, Location> | ArrayRef<Location> | MapRef<Location>

declare const cellValueType: unique symbol
