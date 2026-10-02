import { boxBadgeHTML, resolveBoxType } from "@/utils/box-types"

/**
 * Adds the type badge (icon and label) to the boxes of editor HTML, so
 * previews look like the editor (which renders it in the node view instead),
 * and drops the title bar of boxes that have neither a title nor a badge.
 */
export function renderBoxBadges(html: string) {
  if (!html.includes("data-box=")) return html
  const root = document.createElement("div")
  root.innerHTML = html
  root.querySelectorAll("[data-box]").forEach((element) => {
    const badge = boxBadgeHTML(resolveBoxType(element.getAttribute("data-box")))
    const title = element.querySelector("[data-box-title]")
    if (!title) return
    if (badge) title.insertAdjacentHTML("afterbegin", badge)
    else if (!title.textContent?.trim()) title.remove()
  })
  return root.innerHTML
}
