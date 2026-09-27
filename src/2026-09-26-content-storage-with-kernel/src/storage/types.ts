import { JSONValue } from "./utils"

export interface Storage<CellRef extends JSONValue, ArrayRef extends JSONValue> {
  readonly cell: CellStore<CellRef>
  readonly array: ArrayStore<ArrayRef, ArrayRef | CellRef>
  attach<Ref extends CellRef | ArrayRef>(ref: Ref): Ref
}

export interface CellStore<CellRef> {
  create(value: JSONValue): CellRef
  get(ref: CellRef): JSONValue
  set(ref: CellRef, value: JSONValue): void
}

export interface ArrayStore<ArrayRef extends JSONValue, ItemRef extends JSONValue> {
  create(items: readonly ItemRef[]): ArrayRef
  get(ref: ArrayRef): readonly ItemRef[]
  insert(ref: ArrayRef, index: number, item: ItemRef): void
}
