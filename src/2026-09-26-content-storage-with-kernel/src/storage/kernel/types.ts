export interface StoreKernel<CellRef, ArrayRef> {
  readonly cell: CellKernel<CellRef>
  readonly array: ArrayKernel<ArrayRef, ArrayRef | CellRef>
  attach<Ref extends CellRef | ArrayRef>(ref: Ref): Ref
}

export interface CellKernel<CellRef> {
  create<Value>(value: Value): Cell<CellRef, Value>
  get<Value>(ref: Cell<CellRef, Value>): Value
  update<Value>(ref: Cell<CellRef, Value>, update: Update<Value>): void
}

export type Cell<CellRef, Value> = CellRef & { readonly [cellValueType]: (value: Value) => Value }

declare const cellValueType: unique symbol

// Arrays contain references to values created by the kernel.
export interface ArrayKernel<ArrayRef, ItemRef> {
  create(items: readonly ItemRef[]): ArrayRef
  get(ref: ArrayRef): readonly ItemRef[]
  update(ref: ArrayRef, update: Update<readonly ItemRef[]>): void
}

// utilities

export type Update<Value> = Value | ((previousValue: Value) => Value)
