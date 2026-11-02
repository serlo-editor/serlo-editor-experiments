import { defineCommands, defineNodeSpec, type Extension, union } from "prosekit/core"
import { type Command, NodeSelection } from "prosekit/pm/state"

/** A YouTube video on a line of its own, `src` is the link the author pasted. */
export function defineVideo(): Extension {
  return defineEmbed({
    name: "video",
    className: "embed embed--video",
    title: "YouTube-Video",
    embedUrl: youtubeEmbedUrl,
  })
}

/** A GeoGebra applet on a line of its own, `src` is its link or id. */
export function defineGeogebra(): Extension {
  return defineEmbed({
    name: "geogebra",
    className: "embed embed--geogebra",
    title: "GeoGebra-Applet",
    embedUrl: geogebraEmbedUrl,
  })
}

/**
 * The video id of a YouTube link, for the common shapes: `watch?v=`, `youtu.be`, `embed`,
 * `shorts` and `live`. Returns null for anything else.
 */
export function youtubeEmbedUrl(url: string): string | null {
  let parsed
  try {
    parsed = new URL(url.trim())
  } catch {
    return null
  }
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
  return /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null
}

/**
 * The applet id of a GeoGebra link (`/m/`, `/material/`, the calculator apps, `ggbm.at`)
 * or a bare id. Returns null for anything else.
 */
export function geogebraEmbedUrl(url: string): string | null {
  const trimmed = url.trim()
  const asId = (id: string) =>
    /^[a-zA-Z0-9]{4,24}$/.test(id) ? `https://www.geogebra.org/material/iframe/id/${id}` : null
  if (!trimmed.includes("/") && !trimmed.includes(":")) return asId(trimmed)

  let parsed
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }
  const host = parsed.hostname.replace(/^www\./, "")
  const segments = parsed.pathname.split("/").filter(Boolean)
  if (host === "ggbm.at") return asId(segments[0] ?? "")
  if (host !== "geogebra.org") return null
  const idIndex = segments.indexOf("id")
  return asId((idIndex >= 0 ? segments[idIndex + 1] : segments[1]) ?? "")
}

function defineEmbed({
  name,
  className,
  title,
  embedUrl,
}: {
  name: string
  className: string
  title: string
  embedUrl: (src: string) => string | null
}): Extension {
  const command = `insert${name[0]?.toUpperCase()}${name.slice(1)}`
  return union(
    defineNodeSpec({
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
          url
            ? ["iframe", { src: url, title, allowfullscreen: "true", loading: "lazy" }]
            : ["p", { class: "embed__invalid" }, `${title}: kein gültiger Link`],
        ]
      },
      parseDOM: [
        {
          tag: `div.${className.split(" ").join(".")}`,
          getAttrs: (element) =>
            typeof element === "string" ? null : { src: element.getAttribute("data-src") ?? "" },
        },
      ],
    }),
    defineCommands({ [command]: (src: string) => insertEmbed(name, src) }),
  )
}

function insertEmbed(name: string, src: string): Command {
  return (state, dispatch) => {
    const type = state.schema.nodes[name]
    if (!type) return false
    const node = type.create({ src })
    const { selection } = state
    // a selected embed (e.g. the one just inserted) stays, the new one goes after it
    const tr =
      selection instanceof NodeSelection
        ? state.tr.insert(selection.to, node)
        : state.tr.replaceSelectionWith(node)
    dispatch?.(tr.scrollIntoView())
    return true
  }
}
