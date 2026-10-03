import { forwardRef } from "react"

import { renderBoxBadges } from "@/utils/box-badges"
import { cn } from "@/utils/cn"
import { highlightCodeBlocks } from "@/utils/highlight-code"
import { renderMathFields } from "@/utils/render-math"

/**
 * Renders HTML produced by `RichTextEditor` (previews), with a greyed-out
 * placeholder while it is empty.
 */
export const RichTextOutput = forwardRef<
  HTMLDivElement,
  {
    html: string
    placeholder: string
    onClick?: () => void
    className?: string
  }
>(function RichTextOutput({ html, placeholder, onClick, className }, ref) {
  const shared = "-mx-2 rounded-lg px-2 py-1"

  if (!html)
    return (
      <div
        ref={ref}
        onClick={onClick}
        className={cn(shared, "text-2xl leading-snug text-neutral-300", className)}
      >
        {placeholder}
      </div>
    )

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={cn(shared, "prose prose-2xl max-w-none text-neutral-900", className)}
      // html comes from the tiptap editor; code highlighting, the box
      // badges and the typeset formulas are added here because the editor
      // keeps them out of the document (in decorations and in node views)
      dangerouslySetInnerHTML={{
        __html: renderBoxBadges(highlightCodeBlocks(renderMathFields(html))),
      }}
    />
  )
})
