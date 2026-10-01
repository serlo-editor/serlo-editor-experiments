import type { JSONValue } from "./utils/json-value.ts"

export type NodeKind = "cell" | "array" | "map"

export interface NodeRefsByKind {
  cell: unknown
  array: unknown
  map: unknown
}

export type NodeRef<Refs extends NodeRefsByKind, Kind extends NodeKind = NodeKind> = Refs[Kind]

export interface NodeStore<Refs extends NodeRefsByKind, TransactionContext> {
  readonly cell: CellStore<NodeRef<Refs, "cell">, TransactionContext>
  readonly array: ArrayStore<NodeRef<Refs>, NodeRef<Refs, "array">, TransactionContext>
  readonly map: MapStore<NodeRef<Refs>, NodeRef<Refs, "map">, TransactionContext>

  attach<Ref extends NodeRef<Refs>>(ref: Ref): Ref
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
