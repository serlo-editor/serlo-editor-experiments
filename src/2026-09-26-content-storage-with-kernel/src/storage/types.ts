import { JSONValue } from "./utils"

export interface Storage<CellRef extends JSONValue, ArrayRef extends JSONValue> {
  readonly cell: CellStore<CellRef>
  readonly array: ArrayStore<ArrayRef, ArrayRef | CellRef>
  attach<Ref extends CellRef | ArrayRef>(ref: Ref): Ref
}

type CellStore<CellRef extends JSONValue> = Store<CellRef, JSONValue> & CellOperations<CellRef>
type ArrayStore<ArrayRef extends JSONValue, ItemRef extends JSONValue> = Store<
  ArrayRef,
  ItemRef[]
> &
  ArrayOperations<ArrayRef, ItemRef>

export interface CellOperations<CellRef> {
  set(ref: CellRef, value: JSONValue): void
}

export interface ArrayOperations<ArrayRef extends JSONValue, ItemRef extends JSONValue> {
  insert(ref: ArrayRef, index: number, item: ItemRef): void
}

interface Store<Ref extends JSONValue, Value extends JSONValue> {
  create(value: Value): Ref
  get(ref: Ref): Value
}
