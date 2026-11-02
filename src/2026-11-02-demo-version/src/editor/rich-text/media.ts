import {
  defineCommands,
  defineNodeSpec,
  defineNodeView,
  type Extension,
  union,
} from "prosekit/core"
import { defineImage as defineProseKitImage } from "prosekit/extensions/image"
import type { Node as ProseMirrorNode } from "prosekit/pm/model"
import { type Command, NodeSelection, TextSelection } from "prosekit/pm/state"
import type { EditorView } from "prosekit/pm/view"

import { createIcon, type IconName } from "./icons.ts"

/**
 * Block media keep the link the author pasted. The editor shows a card with that link (see
 * `createMediaCard`), the serialized document the picture or embed learners see.
 */
export function defineImage(): Extension {
  return union(
    defineProseKitImage(),
    defineMediaCard("image", {
      label: "Bild",
      placeholder: "https://…/bild.jpg",
      icon: "image",
      thumbnail: (src) => src || null,
      hint: () => null,
      brokenThumbnailHint: "Bild nicht gefunden",
    }),
    defineInsertMedia("image"),
  )
}

/** A YouTube video on a line of its own. */
export function defineVideo(): Extension {
  return union(
    defineEmbedSpec("video", "embed embed--video", "YouTube-Video", youtubeEmbedUrl),
    defineMediaCard("video", {
      label: "YouTube-Video",
      placeholder: "https://www.youtube.com/watch?v=…",
      icon: "video",
      thumbnail: (src) => {
        const id = youtubeVideoId(src)
        return id && `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
      },
      hint: (src) => (src && !youtubeVideoId(src) ? "Kein YouTube-Link" : null),
    }),
    defineInsertMedia("video"),
  )
}

/** A GeoGebra applet on a line of its own, `src` is its link or id. */
export function defineGeogebra(): Extension {
  return union(
    defineEmbedSpec("geogebra", "embed embed--geogebra", "GeoGebra-Applet", geogebraEmbedUrl),
    defineMediaCard("geogebra", {
      label: "GeoGebra-Applet",
      placeholder: "https://www.geogebra.org/m/…",
      icon: "geogebra",
      thumbnail: () => null,
      hint: (src) => (src && !geogebraEmbedUrl(src) ? "Kein GeoGebra-Link" : null),
    }),
    defineInsertMedia("geogebra"),
  )
}

/** The embed URL of a YouTube link, or null when it is not one. */
export function youtubeEmbedUrl(url: string): string | null {
  const id = youtubeVideoId(url)
  return id && `https://www.youtube-nocookie.com/embed/${id}`
}

/**
 * The embed URL of a GeoGebra link (`/m/`, `/material/`, the calculator apps, `ggbm.at`) or
 * a bare applet id. Returns null for anything else.
 */
export function geogebraEmbedUrl(url: string): string | null {
  const trimmed = url.trim()
  const asId = (id: string) =>
    /^[a-zA-Z0-9]{4,24}$/.test(id) ? `https://www.geogebra.org/material/iframe/id/${id}` : null
  if (!trimmed.includes("/") && !trimmed.includes(":")) return asId(trimmed)

  const parsed = parseUrl(trimmed)
  if (!parsed) return null
  const host = parsed.hostname.replace(/^www\./, "")
  const segments = parsed.pathname.split("/").filter(Boolean)
  if (host === "ggbm.at") return asId(segments[0] ?? "")
  if (host !== "geogebra.org") return null
  const idIndex = segments.indexOf("id")
  return asId((idIndex >= 0 ? segments[idIndex + 1] : segments[1]) ?? "")
}

/** The video id of a YouTube link: `watch?v=`, `youtu.be`, `embed`, `shorts`, `live`. */
function youtubeVideoId(url: string): string | null {
  const parsed = parseUrl(url.trim())
  if (!parsed) return null
  const host = parsed.hostname.replace(/^(www|m)\./, "")
  const [, first = "", second = ""] = parsed.pathname.split("/")
  const id =
    host === "youtu.be"
      ? first
      : host === "youtube.com" || host === "youtube-nocookie.com"
        ? first === "watch"
          ? (parsed.searchParams.get("v") ?? "")
          : ["embed", "shorts", "live", "v"].includes(first)
            ? second
            : ""
        : ""
  return /^[\w-]{6,20}$/.test(id) ? id : null
}

function parseUrl(url: string) {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

function defineEmbedSpec(
  name: string,
  className: string,
  title: string,
  embedUrl: (src: string) => string | null,
): Extension {
  return defineNodeSpec({
    name,
    group: "block",
    atom: true,
    selectable: true,
    draggable: true,
    attrs: { src: { default: "" } },
    toDOM: (node) => {
      const src = String(node.attrs.src)
      const url = embedUrl(src)
      return [
        "div",
        { class: className, "data-src": src },
        ...(url
          ? [["iframe", { src: url, title, allowfullscreen: "true", loading: "lazy" }] as const]
          : []),
      ]
    },
    parseDOM: [
      {
        tag: `div.${className.split(" ").join(".")}`,
        getAttrs: (element) =>
          typeof element === "string" ? null : { src: element.getAttribute("data-src") ?? "" },
      },
    ],
  })
}

/** Inserts empty media whose card asks for the link, e.g. `insertMedia("video")`. */
function defineInsertMedia(name: string): Extension {
  const command = `insert${name[0]?.toUpperCase()}${name.slice(1)}Card`
  return defineCommands({ [command]: () => insertMedia(name) })
}

function insertMedia(name: string): Command {
  return (state, dispatch) => {
    const type = state.schema.nodes[name]
    if (!type) return false
    const node = type.create({ src: "" })
    const { selection } = state
    // a selected media block (e.g. the one just inserted) stays, the new one goes after it
    const tr =
      selection instanceof NodeSelection
        ? state.tr.insert(selection.to, node)
        : state.tr.replaceSelectionWith(node)
    // media at the end leaves no line to continue writing on, so add one
    const after =
      selection instanceof NodeSelection ? selection.to + node.nodeSize : tr.selection.from
    const $after = tr.doc.resolve(after)
    const paragraph = state.schema.nodes.paragraph
    if (paragraph && !$after.parent.isTextblock && !$after.nodeAfter) {
      tr.insert(after, paragraph.create())
    }
    dispatch?.(tr.scrollIntoView())
    return true
  }
}

interface MediaCardOptions {
  label: string
  placeholder: string
  icon: IconName
  /** picture shown next to the link, `null` shows the icon */
  thumbnail: (src: string) => string | null
  /** what is wrong with the link, shown under the field */
  hint: (src: string) => string | null
  /** shown when the thumbnail does not load */
  brokenThumbnailHint?: string
}

function defineMediaCard(name: string, options: MediaCardOptions): Extension {
  return defineNodeView({
    name,
    constructor: (node, view, getPos) => createMediaCard(node, view, getPos, options),
  })
}

/**
 * What block media show in the editor instead of themselves: a thumbnail, the link they come
 * from and a button to remove them. The editor stays a text editor that way.
 */
function createMediaCard(
  initialNode: ProseMirrorNode,
  view: EditorView,
  getPos: () => number | undefined,
  { label, placeholder, icon, thumbnail, hint, brokenThumbnailHint }: MediaCardOptions,
) {
  let node = initialNode
  const dom = element("div", "media-card")
  dom.contentEditable = "false"
  const thumbnailBox = element("span", "media-card__thumbnail")
  const fields = element("label", "media-card__fields")
  const input = element("input", "media-card__input")
  input.type = "url"
  input.placeholder = placeholder
  const hintText = element("span", "media-card__hint")
  fields.append(element("span", "media-card__label", label), input, hintText)
  const remove = element("button", "media-card__remove")
  remove.type = "button"
  remove.title = `${label} löschen`
  remove.setAttribute("aria-label", `${label} löschen`)
  remove.append(createIcon("trash"))
  dom.append(thumbnailBox, fields, remove)

  const src = () => String(node.attrs.src ?? "")
  const showHint = (text: string | null) => {
    hintText.textContent = text ?? ""
    hintText.hidden = !text
  }
  let shownThumbnail: string | null | undefined
  const render = () => {
    if (document.activeElement !== input && input.value !== src()) input.value = src()
    showHint(hint(src()))
    const url = thumbnail(src())
    if (url === shownThumbnail) return
    shownThumbnail = url
    if (!url) {
      thumbnailBox.replaceChildren(createIcon(icon))
      return
    }
    const image = element("img")
    image.alt = ""
    image.draggable = false
    image.addEventListener("error", () => {
      thumbnailBox.replaceChildren(createIcon(icon))
      if (brokenThumbnailHint) showHint(brokenThumbnailHint)
    })
    image.src = url
    thumbnailBox.replaceChildren(image)
  }
  render()

  input.addEventListener("input", () => {
    const pos = getPos()
    if (pos === undefined) return
    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: input.value }))
  })
  // Enter continues writing below the media
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return
    event.preventDefault()
    const pos = getPos()
    if (pos === undefined) return
    const after = view.state.doc.resolve(pos + node.nodeSize)
    view.focus()
    view.dispatch(view.state.tr.setSelection(TextSelection.near(after)))
  })
  remove.addEventListener("click", () => {
    const pos = getPos()
    if (pos === undefined) return
    view.dispatch(view.state.tr.delete(pos, pos + node.nodeSize))
    view.focus()
  })

  // media is inserted without a link, so its field is where the author continues;
  // only for the local author, whose editor has focus while inserting
  if (!src() && view.hasFocus()) requestAnimationFrame(() => input.focus())

  return {
    dom,
    update(next: ProseMirrorNode) {
      if (next.type !== node.type) return false
      node = next
      render()
      return true
    },
    selectNode: () => dom.classList.add("media-card--selected"),
    deselectNode: () => dom.classList.remove("media-card--selected"),
    stopEvent: (event: Event) =>
      event.target instanceof Node &&
      (fields.contains(event.target) || remove.contains(event.target)),
    ignoreMutation: () => true,
  }
}

function element<Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[Tag] {
  const created = document.createElement(tag)
  if (className) created.className = className
  if (text) created.textContent = text
  return created
}
