export interface StoreKernel<Location> {
  readonly cell: CellKernel<Location>
  readonly array: ArrayKernel<Location>
  readonly map: MapKernel<Location>
}

export interface CellKernel<Location> {
  create<Value>(value: Value): CellRef<Value, Location>
  get<Value>(ref: CellRef<Value, Location>): Value
  update<Value>(ref: CellRef<Value, Location>, value: Value | ((oldValue: Value) => Value)): void
}

// Arrays contain references to values created by the kernel.
export interface ArrayKernel<Location> {
  create(items: readonly StoreRef<Location>[]): ArrayRef<Location>
  get(ref: ArrayRef<Location>): readonly StoreRef<Location>[]
  update(
    ref: ArrayRef<Location>,
    items:
      | readonly StoreRef<Location>[]
      | ((oldItems: readonly StoreRef<Location>[]) => readonly StoreRef<Location>[]),
  ): void
}

export interface MapKernel<Location> {
  create(fields: Readonly<Record<string, StoreRef<Location>>>): MapRef<Location>
  get(ref: MapRef<Location>): Readonly<Record<string, StoreRef<Location>>>
  update(
    ref: MapRef<Location>,
    fields:
      | Readonly<Record<string, StoreRef<Location>>>
      | ((
          oldFields: Readonly<Record<string, StoreRef<Location>>>,
        ) => Readonly<Record<string, StoreRef<Location>>>),
  ): void
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
