/**
 * The video id of a YouTube link, for the common shapes: `watch?v=`, `youtu.be`,
 * `embed`, `shorts` and `live`. Returns null for anything else, including
 * other video platforms — those are not supported yet.
 */
export function youtubeVideoId(url: string): string | null {
  let parsed
  try {
    parsed = new URL(url.trim())
  } catch {
    return null
  }
  const host = parsed.hostname.replace(/^(www|m)\./, "")
  const [, first, second] = parsed.pathname.split("/")

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

  return /^[\w-]{6,20}$/.test(id ?? "") ? id : null
}

/** The embed URL of a YouTube link, or null when it is not one */
export function youtubeEmbedUrl(url: string): string | null {
  const id = youtubeVideoId(url)
  return id && `https://www.youtube-nocookie.com/embed/${id}`
}

/** The preview image of a YouTube link, or null when it is not one */
export function youtubeThumbnailUrl(url: string): string | null {
  const id = youtubeVideoId(url)
  return id && `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}
