import { Node, mergeAttributes } from "@tiptap/core"
import type { DOMOutputSpec } from "@tiptap/pm/model"
import { ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react"
import { Shapes } from "lucide-react"

import { MediaCard } from "@/components/media-card"
import { geogebraAppletId, geogebraEmbedUrl } from "@/utils/geogebra"
import { pasteOnEmptyLine } from "@/utils/paste-block"

export const GEOGEBRA_NODE = "geogebra"
export const GEOGEBRA_ATTRIBUTE = "data-geogebra"

const EMBED_PERMISSIONS = "autoplay; fullscreen"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    geogebra: {
      /** inserts an applet on a line of its own, `src` is a GeoGebra URL or id */
      setGeogebra: (src?: string) => ReturnType
    }
  }
}

function GeogebraView({ node, selected, updateAttributes, deleteNode }: NodeViewProps) {
  const src = node.attrs.src as string
  const id = geogebraAppletId(src)

  return (
    <MediaCard
      label="GeoGebra-Applet"
      entries={[
        {
          thumbnail: <Shapes />,
          value: src,
          hint: src && !id ? "Kein GeoGebra-Link" : undefined,
          onChange: (src) => updateAttributes({ src }),
          onRemove: deleteNode,
        },
      ]}
      placeholder="https://www.geogebra.org/m/…"
      selected={selected}
    />
  )
}

/**
 * A GeoGebra applet on a line of its own. The document keeps the URL as it was
 * entered (`data-geogebra`); the editor shows a card with it (see `MediaCard`),
 * `renderHTML` builds the embed the previews show.
 */
export const Geogebra = Node.create({
  name: GEOGEBRA_NODE,
  group: "block",
  atom: true,

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (element) => element.getAttribute(GEOGEBRA_ATTRIBUTE) ?? "",
        renderHTML: ({ src }) => ({ [GEOGEBRA_ATTRIBUTE]: src as string }),
      },
    }
  },

  parseHTML() {
    return [{ tag: `div[${GEOGEBRA_ATTRIBUTE}]` }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const embed = geogebraEmbedUrl(node.attrs.src as string)
    const frame: DOMOutputSpec[] = embed
      ? [
          [
            "iframe",
            {
              src: embed,
              title: "GeoGebra-Applet",
              allow: EMBED_PERMISSIONS,
              allowfullscreen: "true",
              frameborder: "0",
              scrolling: "no",
            },
          ],
        ]
      : []
    return ["div", mergeAttributes(HTMLAttributes, { class: "geogebra" }), ...frame]
  },

  addNodeView() {
    return ReactNodeViewRenderer(GeogebraView)
  },

  addProseMirrorPlugins() {
    const { editor } = this
    return [
      pasteOnEmptyLine(
        "geogebraPaste",
        // only links, a pasted word that happens to look like an id is text
        (text) =>
          /^https?:\/\//.test(text) &&
          !!geogebraAppletId(text) &&
          editor.commands.setGeogebra(text),
      ),
    ]
  },

  addCommands() {
    return {
      setGeogebra:
        (src = "") =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { src } }),
    }
  },
})
