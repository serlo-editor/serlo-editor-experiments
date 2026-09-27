import { JSONValue, Update } from "../utils"

export interface StoreKernel<CellRef extends JSONValue, ArrayRef extends JSONValue> {
  readonly cell: CellKernel<CellRef>
  readonly array: ArrayKernel<ArrayRef, ArrayRef | CellRef>
  attach<Ref extends CellRef | ArrayRef>(ref: Ref): Ref
}

export interface CellKernel<CellRef> {
  create(value: JSONValue): CellRef
  get(ref: CellRef): JSONValue
  update(ref: CellRef, update: Update<JSONValue>): void
}

export interface ArrayKernel<ArrayRef extends JSONValue, ItemRef> {
  create(items: readonly ItemRef[]): ArrayRef
  get(ref: ArrayRef): readonly ItemRef[]
  update(ref: ArrayRef, update: Update<readonly ItemRef[]>): void
}
