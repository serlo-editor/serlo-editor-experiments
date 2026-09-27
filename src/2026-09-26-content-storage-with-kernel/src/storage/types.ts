import { JSONValue } from "./utils"

export interface Storage<CellRef extends JSONValue, ArrayRef extends JSONValue, Transaction> {
  readonly cell: Store<CellRef, JSONValue, Transaction, CellOperations>
  readonly array: Store<
    ArrayRef,
    readonly (CellRef | ArrayRef)[],
    Transaction,
    ArrayOperations<CellRef | ArrayRef>
  >
  attach<Ref extends CellRef | ArrayRef>(ref: Ref): Ref
  mutate<T>(transaction: (tx: Transaction) => T): T
}

export interface CellOperations {
  set(value: JSONValue): void
}

export interface ArrayOperations<ItemRef extends JSONValue> {
  insert(index: number, item: ItemRef): void
}

interface Store<Ref extends JSONValue, Value extends JSONValue, Transaction, Operations> {
  create(value: Value): Ref
  get(ref: Ref): Value
  change(ref: Ref, tx: Transaction): Operations
}
