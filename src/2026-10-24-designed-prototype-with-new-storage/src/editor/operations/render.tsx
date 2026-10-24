import clsx from "clsx"
import { ProseKit } from "prosekit/react"
import type { ReactNode } from "react"

import * as F from "../nodes/flat"
import { isInline } from "../rich-text/types"
import * as S from "../schema"
import type { EditorStore } from "../store/editor-store"

export function render(args: { node: F.FlatNode; store: EditorStore }): ReactNode {
  const { node, store } = args

  if (S.hasCustomBehavior(node.schema) && node.schema.customBehavior.render) {
    return node.schema.customBehavior.render({
      store,
      node,
      renderChild: (childNode) => render({ store, node: childNode }),
    })
  } else if (F.isLiteral(node)) {
    return String(node.value)
  } else if (F.isBoolean(node)) {
    return (
      <input
        key={node.key}
        type="checkbox"
        checked={node.value}
        onChange={(e) => store.update((tx) => tx.update(node.key, () => e.currentTarget.checked))}
      />
    )
  } else if (F.isRichText(node)) {
    const isInlineMode = isInline(node.schema.features)
    const HTMLTag = isInlineMode ? "span" : "div"
    const editor = store.getEditor(node)

    return (
      <ProseKit key={node.key} editor={editor}>
        <HTMLTag
          ref={editor.mount}
          className={clsx("editor-rich-text", isInlineMode ? "editor-rich-text--inline" : null)}
        />
      </ProseKit>
    )
  } else if (F.isSingleton(node)) {
    return render({ store: store, node: F.getSingletonChild({ store, node }) })
  } else if (F.isArray(node) || F.isObject(node)) {
    const HTMLTag = node.schema.htmlTag ?? "div"

    return (
      <HTMLTag key={node.key} className={node.schema.className}>
        {F.getVisibleChildren({ store, node }).map((itemNode) => render({ store, node: itemNode }))}
      </HTMLTag>
    )
  }

  return `[Unsupported node kind: ${node.schema.kind}]`
}
