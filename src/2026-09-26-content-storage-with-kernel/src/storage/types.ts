import type { Branded, JSONValue } from "../utils/index.ts"

export type Ref = Branded<unknown, "Ref">

export interface NodeRefsByKind {
  cell: Ref
  array: Ref
  map: Ref
}

export type NodeKind = keyof NodeRefsByKind

export type NodeRef<Refs extends NodeRefsByKind, Kind extends NodeKind = NodeKind> = Refs[Kind]

export interface NodeStore<Refs extends NodeRefsByKind, TransactionContext> {
  readonly cell: CellStore<NodeRef<Refs, "cell">, TransactionContext>
  readonly array: ArrayStore<NodeRef<Refs>, NodeRef<Refs, "array">, TransactionContext>
  readonly map: MapStore<NodeRef<Refs>, NodeRef<Refs, "map">, TransactionContext>

  attach<Ref extends NodeRef<Refs>>(ref: Ref): Ref
  transact<Result>(callback: (tx: TransactionContext) => Result): Result
}

interface CellStore<Ref, TransactionContext> {
  create<Value extends JSONValue>(value: Value): CellRef<Ref, Value>
  get<Value extends JSONValue>(ref: CellRef<Ref, Value>): Value
  edit<Value extends JSONValue>(ref: CellRef<Ref, Value>, tx: TransactionContext): CellEditor<Value>
}

export type CellRef<Ref, Value extends JSONValue> = Ref & { __value: Value }

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

export interface CellEditor<Value> {
  set(value: Value): void
}

export interface ArrayEditor<ItemRef> {
  insert(index: number, item: ItemRef): void
}

export interface MapEditor<ItemRef> {
  set(field: string, item: ItemRef): void
}
