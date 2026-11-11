import { DOMSerializer, type Schema } from "prosekit/pm/model"
import { useCallback, useLayoutEffect, useRef } from "react"

import type { StoredRichText } from "../schema/rich-text"

/** Serialize content without mounting another ProseMirror view. */
export function StaticRichText({
  value,
  inline = false,
}: {
  value: StoredRichText
  inline?: boolean
}) {
  const host = useRef<HTMLElement>(null)
  const setHost = useCallback((element: HTMLElement | null) => {
    host.current = element
  }, [])
  const schema = value.getEditor().schema
  const content = JSON.stringify(value.snapshot())
  const Tag = inline ? "span" : "div"
  useLayoutEffect(() => {
    host.current?.replaceChildren(serializeContent(schema, content))
  }, [content, schema])
  return <Tag ref={setHost} className="preview-rich-text" />
}

export function serializeContent(schema: Schema, content: string) {
  return DOMSerializer.fromSchema(schema).serializeFragment(
    schema.nodeFromJSON(JSON.parse(content)).content,
  )
}
