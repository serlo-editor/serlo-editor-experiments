/**
 * The applet id of a GeoGebra link, for the common shapes: `/m/`, `/material/`,
 * the calculator apps (`/classic`, `/graphing`, …) and the `ggbm.at` short
 * links. A bare id is taken as one, so it can be typed without the link.
 * Returns null for anything else.
 */
export function geogebraAppletId(url: string): string | null {
  const trimmed = url.trim()
  const isId = (id: string) => (/^[a-zA-Z0-9]{4,24}$/.test(id) ? id : null)

  // a bare id, as it is shown next to the applet on geogebra.org
  if (!trimmed.includes("/") && !trimmed.includes(":")) return isId(trimmed)

  let parsed
  try {
    parsed = new URL(trimmed)
  } catch {
    return null
  }
  const host = parsed.hostname.replace(/^www\./, "")
  const segments = parsed.pathname.split("/").filter(Boolean)

  if (host === "ggbm.at") return isId(segments[0] ?? "")
  if (host !== "geogebra.org") return null

  // `/material/iframe/id/<id>/width/…` keeps the id behind an `id` segment,
  // everywhere else it is the segment after the app or `/m`
  const idIndex = segments.indexOf("id")
  const id = idIndex >= 0 ? segments[idIndex + 1] : segments[1]
  return isId(id ?? "")
}

/** The embed URL of a GeoGebra link, or null when it is not one */
export function geogebraEmbedUrl(url: string): string | null {
  const id = geogebraAppletId(url)
  return id && `https://www.geogebra.org/material/iframe/id/${id}`
}
