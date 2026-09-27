import { JSONValue } from "./utils/index.ts"

export interface Storage<CellRef extends JSONValue, ArrayRef extends JSONValue, Transaction> {
  readonly cell: ReferenceStore<CellRef, JSONValue, Transaction, CellEditor>
  readonly array: ReferenceStore<
    ArrayRef,
    readonly (CellRef | ArrayRef)[],
    Transaction,
    ArrayEditor<CellRef | ArrayRef>
  >
  attach<Ref extends CellRef | ArrayRef>(ref: Ref): Ref
  mutate<T>(transaction: (tx: Transaction) => T): T
}

export interface CellEditor {
  set(value: JSONValue): void
}

export interface ArrayEditor<ItemRef extends JSONValue> {
  insert(index: number, item: ItemRef): void
}

interface ReferenceStore<Ref extends JSONValue, Value extends JSONValue, Transaction, Editor> {
  create(value: Value): Ref
  get(ref: Ref): Value
  edit(ref: Ref, tx: Transaction): Editor
}
