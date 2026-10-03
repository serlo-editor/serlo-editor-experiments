import { Node, mergeAttributes } from "@tiptap/core"
import type { DOMOutputSpec } from "@tiptap/pm/model"
import { ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react"
import { Youtube } from "lucide-react"

import { MediaCard } from "@/components/media-card"
import { pasteOnEmptyLine } from "@/utils/paste-block"
import { youtubeEmbedUrl, youtubeThumbnailUrl, youtubeVideoId } from "@/utils/youtube"

export const VIDEO_NODE = "video"
export const VIDEO_ATTRIBUTE = "data-video"

const EMBED_PERMISSIONS =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    video: {
      /** inserts a video on a line of its own, `src` is a YouTube URL */
      setVideo: (src?: string) => ReturnType
    }
  }
}

function VideoView({ node, selected, updateAttributes, deleteNode }: NodeViewProps) {
  const src = node.attrs.src as string
  const thumbnail = youtubeThumbnailUrl(src)

  return (
    <MediaCard
      label="YouTube-Video"
      entries={[
        {
          thumbnail: thumbnail ? <img src={thumbnail} alt="" draggable={false} /> : <Youtube />,
          value: src,
          hint: src && !thumbnail ? "Kein YouTube-Link" : undefined,
          onChange: (src) => updateAttributes({ src }),
          onRemove: deleteNode,
        },
      ]}
      placeholder="https://www.youtube.com/watch?v=…"
      selected={selected}
    />
  )
}

/**
 * A YouTube video on a line of its own. The document keeps the URL as it was
 * entered (`data-video`); the editor shows a card with it (see `MediaCard`),
 * `renderHTML` builds the embed the previews play.
 */
export const Video = Node.create({
  name: VIDEO_NODE,
  group: "block",
  atom: true,

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (element) => element.getAttribute(VIDEO_ATTRIBUTE) ?? "",
        renderHTML: ({ src }) => ({ [VIDEO_ATTRIBUTE]: src as string }),
      },
    }
  },

  parseHTML() {
    return [{ tag: `div[${VIDEO_ATTRIBUTE}]` }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const embed = youtubeEmbedUrl(node.attrs.src as string)
    const frame: DOMOutputSpec[] = embed
      ? [
          [
            "iframe",
            {
              src: embed,
              title: "YouTube-Video",
              allow: EMBED_PERMISSIONS,
              allowfullscreen: "true",
              frameborder: "0",
            },
          ],
        ]
      : []
    return ["div", mergeAttributes(HTMLAttributes, { class: "video" }), ...frame]
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoView)
  },

  addProseMirrorPlugins() {
    const { editor } = this
    return [
      pasteOnEmptyLine(
        "videoPaste",
        (text) => !!youtubeVideoId(text) && editor.commands.setVideo(text),
      ),
    ]
  },

  addCommands() {
    return {
      setVideo:
        (src = "") =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { src } }),
    }
  },
})
