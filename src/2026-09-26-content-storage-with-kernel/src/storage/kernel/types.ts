import { StorableValue, Update } from "../utils"

export interface StoreKernel<CellRef extends StorableValue, ArrayRef extends StorableValue> {
  readonly cell: CellKernel<CellRef>
  readonly array: ArrayKernel<ArrayRef, ArrayRef | CellRef>
  attach<Ref extends CellRef | ArrayRef>(ref: Ref): Ref
}

export interface CellKernel<CellRef> {
  create(value: StorableValue): CellRef
  get(ref: CellRef): StorableValue
  update(ref: CellRef, update: Update<StorableValue>): void
}

export interface ArrayKernel<ArrayRef extends StorableValue, ItemRef> {
  create(items: readonly ItemRef[]): ArrayRef
  get(ref: ArrayRef): readonly ItemRef[]
  update(ref: ArrayRef, update: Update<readonly ItemRef[]>): void
}
