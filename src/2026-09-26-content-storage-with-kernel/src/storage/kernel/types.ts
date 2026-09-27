import { StorableValue, Update } from "../utils"

export interface StoreKernel<CellRef extends StorableValue, ArrayRef extends StorableValue> {
  readonly cell: CellKernel<CellRef>
  readonly array: ArrayKernel<ArrayRef, ArrayRef | CellRef>
  attach<Ref extends CellRef | ArrayRef>(ref: Ref): Ref
}

export interface CellKernel<CellRef> {
  create<Value extends StorableValue>(value: Value): Cell<CellRef, Value>
  get<Value extends StorableValue>(ref: Cell<CellRef, Value>): Value
  update<Value extends StorableValue>(ref: Cell<CellRef, Value>, update: Update<Value>): void
}

export type Cell<CellRef, Value extends StorableValue> = CellRef & {
  readonly [cellValueType]: (value: Value) => Value
}

declare const cellValueType: unique symbol

// Arrays contain references to values created by the kernel.
export interface ArrayKernel<ArrayRef extends StorableValue, ItemRef> {
  create(items: readonly ItemRef[]): ArrayRef
  get(ref: ArrayRef): readonly ItemRef[]
  update(ref: ArrayRef, update: Update<ArrayRef>): void
}
