import type { NodeJSON } from "prosekit/core"
import { prosemirrorToYXmlFragment, yXmlFragmentToProseMirrorRootNode } from "y-prosemirror"
import type * as Y from "yjs"

import { defineRichTextExtension, type RichTextDefinition } from "./definition.ts"

export function getRichTextFragment(doc: Y.Doc, id: string): Y.XmlFragment {
  if (!id) throw new Error("Rich-text ID must not be empty.")
  return doc.getXmlFragment(`prosemirror:${id}`)
}

/** Explicit single-initializer operation, not a reopen operation. */
export function initializeRichText({
  definition,
  fragment,
  content,
}: {
  definition: RichTextDefinition
  fragment: Y.XmlFragment
  content: unknown
}): void {
  const doc = fragment.doc
  if (!doc) throw new Error("Attach the fragment to a Y.Doc before initialization.")
  const name = [...doc.share].find(([, value]) => Object.is(value, fragment))?.[0]
  if (!name) throw new Error("Initialization requires a named top-level fragment.")

  const initialized = doc.getMap<boolean>("rich-text:initialized")
  if (initialized.has(name) || fragment.length > 0) {
    throw new Error("Rich-text fragment is already initialized.")
  }

  const schema = getSchema(definition)
  const node = schema.nodeFromJSON(content)
  if (node.type !== schema.topNodeType) throw new Error("Expected a rich-text document.")
  node.check()

  doc.transact(() => {
    prosemirrorToYXmlFragment(node, fragment)
    initialized.set(name, true)
  }, "rich-text:initialize")
}

export function exportRichText({
  definition,
  fragment,
}: {
  definition: RichTextDefinition
  fragment: Y.XmlFragment
}): NodeJSON {
  const node = yXmlFragmentToProseMirrorRootNode(fragment, getSchema(definition))
  node.check()
  return node.toJSON()
}

function getSchema(definition: RichTextDefinition) {
  const schema = defineRichTextExtension(definition).schema
  if (!schema) throw new Error("Rich-text definition did not produce a schema.")
  return schema
}
