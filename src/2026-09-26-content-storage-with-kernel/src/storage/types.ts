import { JSONValue } from "./utils/index.ts"

export interface NodeStore<CellRef, ArrayRef, MapRef, TransactionContext> {
  readonly cell: CellStore<CellRef, TransactionContext>
  readonly array: ArrayStore<NodeRef<CellRef, ArrayRef, MapRef>, ArrayRef, TransactionContext>
  readonly map: MapStore<NodeRef<CellRef, ArrayRef, MapRef>, MapRef, TransactionContext>

  attach<Ref extends NodeRef<CellRef, ArrayRef, MapRef>>(ref: Ref): Ref
  transact<Result>(callback: (tx: TransactionContext) => Result): Result
}

interface CellStore<Ref, TransactionContext> {
  create(value: JSONValue): Ref
  get(ref: Ref): JSONValue
  edit(ref: Ref, tx: TransactionContext): CellEditor
}

interface ArrayStore<ItemRef, ArrayRef, TransactionContext> {
  create(items: readonly ItemRef[]): ArrayRef
  get(ref: ArrayRef): readonly ItemRef[]
  edit(ref: ArrayRef, tx: TransactionContext): ArrayEditor<ItemRef>
}

interface MapStore<ItemRef, MapRef, TransactionContext> {
  create(fields: Readonly<Record<string, ItemRef>>): MapRef
  get(ref: MapRef): Readonly<Record<string, ItemRef>>
  edit(ref: MapRef, tx: TransactionContext): MapEditor<ItemRef>
}

type NodeRef<CellRef, ArrayRef, MapRef> = CellRef | ArrayRef | MapRef

export interface CellEditor {
  set(value: JSONValue): void
}

export interface ArrayEditor<ItemRef> {
  insert(index: number, item: ItemRef): void
}

export interface MapEditor<ItemRef> {
  set(field: string, item: ItemRef): void
}
