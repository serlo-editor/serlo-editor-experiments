import { JSONValue } from "./utils/index.ts"

export interface Storage<CellRef, ArrayRef, TransactionContext> {
  readonly cell: CellStore<CellRef, TransactionContext>
  readonly array: ArrayStore<CellRef, ArrayRef, TransactionContext>

  attach<Ref extends NodeRef<CellRef, ArrayRef>>(ref: Ref): Ref
  transact<Result>(callback: (tx: TransactionContext) => Result): Result
}

interface CellStore<Ref, TransactionContext> {
  create(value: JSONValue): Ref
  get(ref: Ref): JSONValue
  edit(ref: Ref, tx: TransactionContext): CellEditor
}

interface ArrayStore<CellRef, ArrayRef, TransactionContext> {
  create(items: readonly NodeRef<CellRef, ArrayRef>[]): ArrayRef
  get(ref: ArrayRef): readonly NodeRef<CellRef, ArrayRef>[]
  edit(ref: ArrayRef, tx: TransactionContext): ArrayEditor<NodeRef<CellRef, ArrayRef>>
}

type NodeRef<CellRef, ArrayRef> = CellRef | ArrayRef

export interface CellEditor {
  set(value: JSONValue): void
}

export interface ArrayEditor<ItemRef> {
  insert(index: number, item: ItemRef): void
}
