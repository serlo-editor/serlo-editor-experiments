/** an `http(s)` link to an image file, which is what we can show */
export function imageUrl(text: string): string | null {
  try {
    const { protocol, pathname } = new URL(text)
    return /^https?:$/.test(protocol) && /\.(png|jpe?g|avif|webp)$/i.test(pathname) ? text : null
  } catch {
    return null
  }
}
