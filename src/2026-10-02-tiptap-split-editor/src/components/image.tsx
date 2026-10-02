import { InputRule, mergeAttributes } from "@tiptap/core"
import TiptapImage from "@tiptap/extension-image"
import type { DOMOutputSpec } from "@tiptap/pm/model"
import { ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react"
import { Image as ImageIcon } from "lucide-react"
import { useState } from "react"

import { MediaCard, type MediaEntry } from "@/components/media-card"
import { imageUrl } from "@/utils/image"
import { pasteOnEmptyLine } from "@/utils/paste-block"

export const GALLERY_CLASS = "gallery"

/** the image itself first, the further ones of a gallery after it */
function sourcesOf(attrs: Record<string, unknown>): string[] {
  return [attrs.src as string, ...((attrs.more as string[]) ?? [])]
}

/** the `src` of every image inside a rendered gallery */
function gallerySources(element: HTMLElement): string[] {
  return [...element.querySelectorAll("img")].map((image) => image.getAttribute("src") ?? "")
}

function ImageView({ node, selected, updateAttributes, deleteNode }: NodeViewProps) {
  const sources = sourcesOf(node.attrs)
  // a URL is typed character by character, most of them lead nowhere, so the
  // ones that do not load are kept by URL rather than by position
  const [failed, setFailed] = useState<string[]>([])

  const update = (sources: string[]) => {
    const [src = "", ...more] = sources
    updateAttributes({ src, more })
  }

  const entries: MediaEntry[] = sources.map((src, index) => {
    const hasFailed = !!src && failed.includes(src)
    return {
      thumbnail:
        src && !hasFailed ? (
          <img
            src={src}
            alt=""
            draggable={false}
            onError={() => setFailed((failed) => [...failed, src])}
          />
        ) : (
          <ImageIcon />
        ),
      value: src,
      hint: hasFailed ? "Bild nicht gefunden" : undefined,
      onChange: (value) => update(sources.map((src, at) => (at === index ? value : src))),
      // the last image goes together with the block it is alone in
      onRemove: () =>
        sources.length > 1 ? update(sources.filter((_, at) => at !== index)) : deleteNode(),
    }
  })

  return (
    <MediaCard
      label="Bild"
      entries={entries}
      placeholder="https://…/bild.jpg"
      selected={selected}
      addLabel="Bild hinzufügen"
      onAdd={() => update([...sources, ""])}
    />
  )
}

/**
 * One image, or a gallery of them, with a working `![Alt](url)` shortcut: the
 * built-in rule replaces the typed text in place, where the image — a block —
 * does not fit, and so is dropped; `setImage` puts it on a line of its own
 * instead. A pasted image link becomes the image itself. In the editor it is a
 * card with a link per image, see `MediaCard`; the previews show a single
 * image as itself and several of them side by side.
 */
export const Image = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),

      src: {
        default: "",
        parseHTML: (element) =>
          element.tagName === "IMG"
            ? element.getAttribute("src")
            : (gallerySources(element)[0] ?? ""),
      },

      /** the images after the first one, which turn this into a gallery */
      more: {
        default: [] as string[],
        parseHTML: (element) => (element.tagName === "IMG" ? [] : gallerySources(element).slice(1)),
        // they are rendered as images of their own, not as an attribute
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [...(this.parent?.() ?? []), { tag: `div.${GALLERY_CLASS}` }]
  },

  renderHTML({ node, HTMLAttributes }) {
    // an image that has no link yet is left out; an empty gallery stays an
    // empty image, which the previews hide
    const sources = sourcesOf(node.attrs).filter(Boolean)
    if (sources.length < 2)
      return [
        "img",
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          src: sources[0] ?? "",
        }),
      ]

    const images: DOMOutputSpec[] = sources.map((src) => [
      "img",
      mergeAttributes(this.options.HTMLAttributes, { src, alt: "" }),
    ])
    return ["div", { class: GALLERY_CLASS }, ...images]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },

  addInputRules() {
    return [
      new InputRule({
        find: /!\[(.*?)\]\((\S+?)(?:\s+["'](.*?)["'])?\)$/,
        handler: ({ chain, range, match }) => {
          const [, alt, src, title] = match
          chain().deleteRange(range).setImage({ src, alt, title }).run()
        },
      }),
    ]
  },

  addProseMirrorPlugins() {
    const { editor } = this
    return [
      ...(this.parent?.() ?? []),
      pasteOnEmptyLine("imagePaste", (text) => {
        const src = imageUrl(text)
        return !!src && editor.commands.setImage({ src })
      }),
    ]
  },
})
