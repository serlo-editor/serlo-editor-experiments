import * as Y from "yjs"

import type { Root } from "../content"
import * as N from "../nodes/nested"
import { createRichTextEditor } from "../rich-text/create-editor"
import type { Transaction } from "../store/editor-store"
import type { Key } from "../store/key"

export function saveRoot(args: { tx: Transaction; node: N.NestedNode<Root>; rootKey: Key }): Key {
  const { tx, node, rootKey } = args

  return tx.attachRoot(rootKey, save({ tx, parentKey: rootKey, node: N.getSingletonChild(node) }))
}

export function save(args: { tx: Transaction; parentKey: Key; node: N.NestedNode }): Key {
  const { tx, parentKey, node } = args

  if (N.isPrimitive(node)) {
    return tx.insert(node.schema, parentKey, () => node.value)
  } else if (N.isRichText(node)) {
    const key = tx.insert(node.schema, parentKey, () => null)

    const editor = createRichTextEditor({
      key,
      schema: node.schema,
      store: tx.store,
      defaultContent: node.value,
    })

    tx.setEditor(key, editor)

    return key
  } else if (N.isSingleton(node)) {
    return tx.insert(node.schema, parentKey, (key) =>
      save({ tx, parentKey: key, node: N.getSingletonChild(node) }),
    )
  } else if (N.isArray(node)) {
    return tx.insert(node.schema, parentKey, (key) => {
      const list = new Y.Array<Key>()

      list.push(N.getItems(node).map((itemNode) => save({ tx, parentKey: key, node: itemNode })))

      return list
    })
  } else if (N.isObject(node)) {
    return tx.insert(node.schema, parentKey, (key) => {
      const map = new Y.Map<Key>()

      for (const propertyName of Object.keys(node.schema.properties)) {
        const propertyNode = N.getProperty(node, propertyName)

        const propertyKey = save({ tx, parentKey: key, node: propertyNode })

        map.set(propertyName, propertyKey)
      }

      return map
    })
  } else {
    throw new Error(`Unsupported schema kind: ${node.schema.kind}`)
  }
}
