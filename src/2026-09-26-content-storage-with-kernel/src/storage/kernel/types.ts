export interface StoreKernel<Cell, ArrayRef> {
  readonly cell: CellKernel<Cell>
  readonly array: ArrayKernel<Cell, ArrayRef | Cell>
}

export interface CellKernel<Cell> {
  create<Value>(value: Value): TypedCell<Cell, Value>
  get<Value>(ref: TypedCell<Cell, Value>): Value
  update<Value>(ref: TypedCell<Cell, Value>, value: Update<Value>): void
}

export type TypedCell<Cell, Value> = Cell & { readonly [cellValueType]: (value: Value) => Value }

declare const cellValueType: unique symbol

// Arrays contain references to values created by the kernel.
export interface ArrayKernel<ArrayRef, ElementRef> {
  create(items: readonly ElementRef[]): ArrayRef
  get(ref: ArrayRef): readonly ElementRef[]
  update(ref: ArrayRef, items: Update<readonly ElementRef[]>): void
}

// utilities

export type Update<Value> = Value | ((oldValue: Value) => Value)
