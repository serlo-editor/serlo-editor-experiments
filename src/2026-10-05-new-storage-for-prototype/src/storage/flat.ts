import { definePlugin } from "prosekit/core"
import type { Node as ProseMirrorNode } from "prosekit/pm/model"
import { Plugin } from "prosekit/pm/state"

import {
  createRichTextEditor,
  type RichTextEditor,
  type RichTextEditorConfig,
  type RichTextEditorOptions,
} from "../rich-text/index.ts"
import type { Branded, JSONValue } from "../utils/index.ts"
import { ChangeTracker } from "./change-tracker.ts"
import type { NodeKind, NodeStore, Ref, RichTextId } from "./types.ts"

type FlatNodeRefs = {
  [Kind in NodeKind]: Ref & Branded<string, Kind>
}
type FlatNodeRef = FlatNodeRefs[NodeKind]

type FlatNodeStoreContract = NodeStore<FlatNodeRefs, TransactionToken>

export class FlatNodeStore implements FlatNodeStoreContract {
  private readonly editors = new Map<RichTextId, RichTextEditor>()
  private readonly activeTransactions = new Set<TransactionToken>()
  private readonly changes = new ChangeTracker()
  private rootRef: FlatNodeRef | undefined

  private readonly cellTable = new ReferenceTable<"cell", JSONValue>(() => this.changes.publish())
  private readonly arrayTable = new ReferenceTable<"array", readonly FlatNodeRef[]>(() =>
    this.changes.publish(),
  )
  private readonly mapTable = new ReferenceTable<"map", Readonly<Record<string, FlatNodeRef>>>(() =>
    this.changes.publish(),
  )

  readonly cell: FlatNodeStoreContract["cell"] = {
    create: (value) => this.cellTable.create(value),
    get: (ref) => this.cellTable.get(ref),
    edit: (ref, tx) => {
      this.assertActiveTransaction(tx)
      return {
        set: (value) => this.cellTable.applyUpdate(ref, () => value),
      }
    },
  }

  readonly array: FlatNodeStoreContract["array"] = {
    create: (items) => this.arrayTable.create(items),
    get: (ref) => this.arrayTable.get(ref),
    edit: (ref, tx) => {
      this.assertActiveTransaction(tx)
      return {
        remove: (index) => {
          this.arrayTable.applyUpdate(ref, (previousItems) => [
            ...previousItems.slice(0, index),
            ...previousItems.slice(index + 1),
          ])
        },
        insert: (index, item) => {
          this.arrayTable.applyUpdate(ref, (previousItems) => [
            ...previousItems.slice(0, index),
            item,
            ...previousItems.slice(index),
          ])
        },
      }
    },
  }

  readonly map: FlatNodeStoreContract["map"] = {
    create: (fields) => this.mapTable.create(fields),
    get: (ref) => this.mapTable.get(ref),
    edit: (ref, tx) => {
      this.assertActiveTransaction(tx)
      return {
        set: (field, item) => {
          this.mapTable.applyUpdate(ref, (previousFields) =>
            previousFields[field] === item ? previousFields : { ...previousFields, [field]: item },
          )
        },
        remove: (field) => {
          this.mapTable.applyUpdate(ref, (previousFields) => {
            if (!Object.hasOwn(previousFields, field)) return previousFields
            const fields = { ...previousFields }
            delete fields[field]
            return fields
          })
        },
      }
    },
  }

  createRichText(options: RichTextEditorOptions): RichTextId {
    const id: RichTextId = `rich-text:${crypto.randomUUID()}`
    let editor: RichTextEditor | undefined
    let previousDoc: ProseMirrorNode | undefined
    let pending = false

    // Plugin state hooks also run for headless commands and setContent(). Notify
    // after state installation, coalescing changes within one microtask.
    const scheduleChange = () => {
      if (pending) return
      pending = true
      queueMicrotask(() => {
        pending = false
        if (!editor || !previousDoc || previousDoc.eq(editor.state.doc)) return
        previousDoc = editor.state.doc
        this.changes.publish()
      })
    }

    editor = createRichTextEditor({
      ...options,
      ...(options.defaultContent === undefined
        ? {}
        : { defaultContent: structuredClone(options.defaultContent) }),
      extensions: [
        ...(options.extensions ?? []),
        definePlugin(
          new Plugin({
            state: {
              init() {
                scheduleChange()
                return null
              },
              apply(transaction) {
                if (transaction.docChanged) scheduleChange()
                return null
              },
            },
          }),
        ),
      ],
    })
    previousDoc = editor.state.doc
    previousDoc.check()
    this.editors.set(id, editor)
    return id
  }

  getEditor(id: RichTextId, _config: RichTextEditorConfig): RichTextEditor {
    const editor = this.editors.get(id)

    // Since the FlatNodeStore is only used in a single editor instance (no multiuser
    // collaboration), we can assume that each queried editor was previously created by
    // createRichText(). If the editor is not found, it means a deeper problem
    // in the code.
    if (!editor) throw new Error(`Unknown rich-text ID: ${id}.`)
    return editor
  }

  readonly root: FlatNodeStoreContract["root"] = {
    getOrCreate: (create) => this.transact((tx) => this.rootRef ?? this.root.save(create(), tx)),
    save: (ref, tx) => {
      this.assertActiveTransaction(tx)
      if (!this.cellTable.has(ref) && !this.arrayTable.has(ref) && !this.mapTable.has(ref)) {
        throw new Error(`Reference with key ${ref} does not exist.`)
      }
      if (this.rootRef !== ref) {
        this.rootRef = ref
        this.changes.publish()
      }
      return ref
    },
  }

  getRevision(): number {
    return this.changes.getRevision()
  }

  subscribe(listener: () => void): () => void {
    return this.changes.subscribe(listener)
  }

  transact<T>(callback: (tx: TransactionToken) => T): T {
    return this.changes.batch(() => {
      const tx = Symbol("transactionTransaction") as TransactionToken
      this.activeTransactions.add(tx)
      try {
        return callback(tx)
      } finally {
        this.activeTransactions.delete(tx)
      }
    })
  }

  private assertActiveTransaction(tx: TransactionToken): void {
    if (!this.activeTransactions.has(tx)) {
      throw new Error("Invalid transaction.")
    }
  }
}

class ReferenceTable<Kind extends NodeKind, Value extends JSONValue> {
  private static counter = 0
  private readonly table = new Map<FlatNodeRefs[Kind], Value>()

  constructor(private readonly onChange: () => void) {}

  create(value: Value): FlatNodeRefs[Kind] {
    const ref = `node:${ReferenceTable.counter++}` as FlatNodeRefs[Kind]
    this.table.set(ref, value)
    return ref
  }

  get(ref: FlatNodeRefs[Kind]): Value {
    const value = this.table.get(ref)
    if (value === undefined) {
      throw new Error(`Value with key ${ref} does not exist.`)
    }
    return value
  }

  applyUpdate(ref: FlatNodeRefs[Kind], updater: Update<Value>): void {
    const previousValue = this.get(ref)
    const value = typeof updater === "function" ? updater(previousValue) : updater
    if (Object.is(previousValue, value)) return
    this.table.set(ref, value)
    this.onChange()
  }

  has(ref: FlatNodeRef): boolean {
    return this.table.has(ref as FlatNodeRefs[Kind])
  }
}

export type Update<Value extends JSONValue> = Value | ((previousValue: Value) => Value)

type TransactionToken = Branded<symbol, "TransactionToken">
