import { JSONValue, Update } from "../utils"

export interface Storage<CellRef extends JSONValue, ArrayRef extends JSONValue> {
  readonly cell: CellStore<CellRef>
  readonly array: ArrayStore<ArrayRef, ArrayRef | CellRef>
  attach<Ref extends CellRef | ArrayRef>(ref: Ref): Ref
}

export interface CellStore<CellRef> {
  create(value: JSONValue): CellRef
  get(ref: CellRef): JSONValue
  update(ref: CellRef, update: Update<JSONValue>): void
}

export interface ArrayStore<ArrayRef extends JSONValue, ItemRef extends JSONValue> {
  create(items: readonly ItemRef[]): ArrayRef
  get(ref: ArrayRef): readonly ItemRef[]
  update(ref: ArrayRef, update: Update<readonly ItemRef[]>): void
}
