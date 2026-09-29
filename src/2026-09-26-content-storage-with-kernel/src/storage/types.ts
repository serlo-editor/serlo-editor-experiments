import { JSONValue } from "./utils/index.ts"

export interface Storage<CellRef, ArrayRef, TransactionContext> {
  readonly cell: ValueStore<CellRef, JSONValue, TransactionContext, CellEditor>
  readonly array: ValueStore<
    ArrayRef,
    readonly (CellRef | ArrayRef)[],
    TransactionContext,
    ArrayEditor<CellRef | ArrayRef>
  >
  attach<Ref extends CellRef | ArrayRef>(ref: Ref): Ref
  transact<T>(callback: (tx: TransactionContext) => T): T
}

export interface CellEditor {
  set(value: JSONValue): void
}

export interface ArrayEditor<ItemRef> {
  insert(index: number, item: ItemRef): void
}

interface ValueStore<Ref, Value, TransactionContext, Editor> {
  create(value: Value): Ref
  get(ref: Ref): Value
  edit(ref: Ref, tx: TransactionContext): Editor
}
