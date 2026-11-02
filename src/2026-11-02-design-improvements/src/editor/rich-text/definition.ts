import {
  defineBaseKeymap,
  defineCommands,
  defineKeymap,
  defineMarkSpec,
  defineNodeAttr,
  defineNodeSpec,
  type Extension,
  toggleMark,
  union,
} from "prosekit/core"
import { defineBold } from "prosekit/extensions/bold"
import { defineCodeBlock } from "prosekit/extensions/code-block"
import { defineHeading } from "prosekit/extensions/heading"
import { defineItalic } from "prosekit/extensions/italic"
import { defineLink } from "prosekit/extensions/link"
import { defineList } from "prosekit/extensions/list"
import { defineParagraph } from "prosekit/extensions/paragraph"
import { defineTable } from "prosekit/extensions/table"
import { defineText } from "prosekit/extensions/text"

import { defineMath } from "./math.ts"
import { defineGeogebra, defineImage, defineVideo } from "./media.ts"
import { defineBox, defineSpoiler } from "./titled-block.ts"

export interface Marks {
  readonly bold?: boolean
  readonly italic?: boolean
  readonly link?: boolean
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
    readonly heading?: boolean
    readonly orderedList?: boolean
    readonly bulletList?: boolean
    readonly codeBlock?: boolean
    /** inline and block formulas */
    readonly math?: boolean
    readonly spoiler?: boolean
    readonly box?: boolean
    readonly image?: boolean
    readonly video?: boolean
    readonly geogebra?: boolean
    readonly table?: boolean
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
    const { heading, orderedList, bulletList, ...blocks } = definition.config.blocks
    if (heading) {
      extensions.push(
        defineHeading(),
        defineNodeAttr({ type: "heading", attr: "level", default: 1 }),
      )
    }
    if (orderedList || bulletList) {
      extensions.push(
        defineList(),
        defineNodeAttr({
          type: "list",
          attr: "kind",
          default: bulletList ? "bullet" : "ordered",
        }),
      )
    }
    if (blocks.codeBlock) extensions.push(defineCodeBlock())
    if (blocks.math) extensions.push(defineMath())
    if (blocks.spoiler) extensions.push(defineSpoiler())
    if (blocks.box) extensions.push(defineBox())
    if (blocks.image) extensions.push(defineImage())
    if (blocks.video) extensions.push(defineVideo())
    if (blocks.geogebra) extensions.push(defineGeogebra())
    if (blocks.table) extensions.push(defineTable())
  }

  const marks = definition.config.marks
  if (marks?.bold) extensions.push(defineBold())
  if (marks?.italic) extensions.push(defineItalic())
  if (marks?.link) extensions.push(defineLink())
  if (marks?.gap) extensions.push(defineGap())

  return union(extensions)
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
