import type {
  RichTextEditor,
  RichTextEditorConfig,
  RichTextEditorOptions,
} from "../rich-text/index.ts"
import type { Branded, JSONValue } from "../utils/index.ts"

export type RichTextId = `rich-text:${string}`

export type Ref = Branded<unknown, "Ref">
export type RootRef = Branded<Ref, "RootRef">

export interface NodeRefs {
  cell: Ref
  array: Ref
  map: Ref
}

export type NodeKind = keyof NodeRefs

export interface NodeStore<Refs extends NodeRefs = NodeRefs, TransactionContext = unknown> {
  readonly cell: CellStore<Refs["cell"], TransactionContext>
  readonly array: ArrayStore<Refs[NodeKind], Refs["array"], TransactionContext>
  readonly map: MapStore<Refs[NodeKind], Refs["map"], TransactionContext>

  createRichText(options: RichTextEditorOptions): RichTextId
  /** Configuration is fixed when an editor is first created in this store. */
  getEditor(id: RichTextId, config: RichTextEditorConfig): RichTextEditor

  // TODO: Merge those functions together so that there is a common implementation
  // for both storage types.
  //
  // TODO: Find a good way that getRoot() does not return undefined
  // => it should mimic the lifecycle
  getRoot(): (Refs[NodeKind] & RootRef) | undefined
  getRevision(): number
  subscribe(listener: () => void): () => void
  // TODO: Maybe rename to save()
  //
  // TODO: Maybe return something else than root ref to simplify usage
  save(ref: Refs[NodeKind], tx: TransactionContext): Refs[NodeKind] & RootRef
  /** Errors propagate, but transaction changes are not rolled back. */
  transact<Result>(callback: (tx: TransactionContext) => Result): Result
}

export function isRichTextId(value: unknown): value is RichTextId {
  return typeof value === "string" && value.startsWith("rich-text:") && value.length > 10
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
  remove(index: number): void
  insert(index: number, item: ItemRef): void
}

export interface MapEditor<ItemRef> {
  set(field: string, item: ItemRef): void
  remove(field: string): void
}
