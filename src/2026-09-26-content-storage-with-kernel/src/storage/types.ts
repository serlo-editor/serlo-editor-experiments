import type { Branded, JSONValue } from "../utils/index.ts"

export type Ref = Branded<unknown, "Ref">
export type RootRef = Branded<Ref, "RootRef">

export interface NodeRefs {
  cell: Ref
  array: Ref
  map: Ref
}

export type NodeKind = keyof NodeRefs

export interface NodeStore<Refs extends NodeRefs, TransactionContext> {
  readonly cell: CellStore<Refs["cell"], TransactionContext>
  readonly array: ArrayStore<Refs[NodeKind], Refs["array"], TransactionContext>
  readonly map: MapStore<Refs[NodeKind], Refs["map"], TransactionContext>

  attach<Ref extends Refs[NodeKind]>(ref: Ref): Ref & RootRef
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

export interface CellEditor {
  set(value: JSONValue): void
}

export interface ArrayEditor<ItemRef> {
  insert(index: number, item: ItemRef): void
}

export interface MapEditor<ItemRef> {
  set(field: string, item: ItemRef): void
}
