import {
  defineBaseKeymap,
  defineCommands,
  defineKeymap,
  defineMarkSpec,
  defineNodeAttr,
  defineNodeSpec,
  definePlugin,
  type Extension,
  toggleMark,
  union,
} from "prosekit/core"
import { defineBold } from "prosekit/extensions/bold"
import { defineHeading } from "prosekit/extensions/heading"
import { defineItalic } from "prosekit/extensions/italic"
import { defineList } from "prosekit/extensions/list"
import { defineParagraph } from "prosekit/extensions/paragraph"
import { defineText } from "prosekit/extensions/text"
import type { ProseMirrorNode } from "prosekit/pm/model"
import { Plugin } from "prosekit/pm/state"

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface Marks {
  readonly bold?: boolean
  readonly italic?: boolean
  readonly gap?: boolean
}

export interface InlineConfig {
  readonly marks?: Marks
  readonly blocks?: never
}

export interface BlockConfig {
  readonly marks?: Marks
  readonly blocks: {
    readonly paragraph: true
    readonly heading?: { readonly levels: readonly [HeadingLevel, ...HeadingLevel[]] }
    readonly list?: { readonly ordered?: boolean; readonly bullet?: boolean }
  }
}

export type RichTextDefinition =
  | { readonly mode: "inline"; readonly config: InlineConfig }
  | { readonly mode: "block"; readonly config: BlockConfig }

export const richText = {
  inline(config: InlineConfig = {}): RichTextDefinition {
    return { mode: "inline", config }
  },
  block(config: BlockConfig): RichTextDefinition {
    if (config.blocks.heading && config.blocks.heading.levels.length === 0) {
      throw new Error("Enable at least one heading level.")
    }
    const list = config.blocks.list
    if (list && !list.ordered && !list.bullet) {
      throw new Error("Enable at least one list kind.")
    }
    return { mode: "block", config }
  },
}

/** Shared compiler for editor creation and headless JSON import/export. */
export function defineRichTextExtension(definition: RichTextDefinition): Extension {
  const extensions: Extension[] = [
    defineBaseKeymap(),
    defineNodeSpec({
      name: "doc",
      content: definition.mode === "inline" ? "inlineBlock" : "block+",
      topNode: true,
    }),
    defineText(),
  ]

  if (definition.mode === "inline") {
    extensions.push(
      defineNodeSpec({
        name: "inlineBlock",
        content: "inline*",
        group: "block",
        toDOM: () => ["span", { class: "inline-rich-text" }, 0],
      }),
    )
  } else {
    extensions.push(defineParagraph())
    const { heading, list } = definition.config.blocks
    if (heading) {
      extensions.push(
        defineHeading(),
        defineNodeAttr({
          type: "heading",
          attr: "level",
          default: heading.levels[0],
        }),
      )
    }
    if (list) {
      extensions.push(
        defineList(),
        defineNodeAttr({
          type: "list",
          attr: "kind",
          default: list.bullet ? "bullet" : "ordered",
        }),
      )
    }
  }

  const marks = definition.config.marks
  if (marks?.bold) extensions.push(defineBold())
  if (marks?.italic) extensions.push(defineItalic())
  if (marks?.gap) extensions.push(defineGap())

  // Attribute validators can throw while commands build transactions.
  // Filter unsupported capabilities here instead, before edits reach Yjs.
  extensions.push(
    definePlugin(
      new Plugin({
        filterTransaction(transaction) {
          if (!transaction.docChanged) return true
          try {
            // ponytail: full-document check; validate changed ranges if large documents demand it.
            validateRichTextContent(transaction.doc, definition)
            return true
          } catch {
            return false
          }
        },
      }),
    ),
  )
  return union(extensions)
}

/** Shared validation for editing, import, and export. */
export function validateRichTextContent(
  node: ProseMirrorNode,
  definition: RichTextDefinition,
): void {
  node.check()
  if (definition.mode !== "block") return

  const { heading, list } = definition.config.blocks
  node.descendants((child) => {
    if (
      child.type.name === "heading" &&
      !heading?.levels.some((level) => level === child.attrs.level)
    ) {
      throw new RangeError(`Heading level ${child.attrs.level} is not enabled.`)
    }
    if (
      child.type.name === "list" &&
      !(child.attrs.kind === "bullet" && list?.bullet) &&
      !(child.attrs.kind === "ordered" && list?.ordered)
    ) {
      throw new RangeError(`List kind ${child.attrs.kind} is not enabled.`)
    }
  })
}

function defineGap(): Extension {
  return union(
    defineMarkSpec({
      name: "gap",
      parseDOM: [{ tag: 'span[data-gap="true"]' }],
      toDOM: () => ["span", { class: "gap-mark", "data-gap": "true" }, 0],
    }),
    defineCommands({ toggleGap: () => toggleMark({ type: "gap" }) }),
    defineKeymap({ "Mod-Alt-g": toggleMark({ type: "gap" }) }),
  )
}
