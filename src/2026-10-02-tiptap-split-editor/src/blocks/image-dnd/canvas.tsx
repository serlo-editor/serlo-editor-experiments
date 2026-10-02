import { forwardRef, useEffect, useState } from "react"

import { cn } from "@/utils/cn"

import { BLANK_CANVAS_RATIO, type ImageDndState } from "./state"

/**
 * The area the drop zones sit on: the picture, or a colored rectangle while
 * there is none. Children are positioned absolutely inside it, in percent.
 *
 * The box wraps the picture at its displayed size — with a picture the
 * element shrinks to fit (`w-fit`), so a tall one capped by `maxHeight` is
 * narrower than the column it sits in and the zones still line up with it.
 */
export const Canvas = forwardRef<
  HTMLDivElement,
  {
    state: Pick<ImageDndState, "image" | "backgroundColor">
    /** any CSS length, keeps a tall picture from filling the whole pane */
    maxHeight: string
    className?: string
    children?: React.ReactNode
  } & Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "className">
>(function Canvas({ state, maxHeight, className, children, ...rest }, ref) {
  // a picture that does not load falls back to the colored area, so the
  // zones keep their place while the author fixes the link
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [state.image])
  const hasImage = !!state.image && !failed

  return (
    <div
      ref={ref}
      {...rest}
      className={cn(
        "relative overflow-hidden rounded-lg",
        hasImage ? "w-fit" : "w-full",
        className,
      )}
    >
      {hasImage ? (
        <img
          src={state.image}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          style={{ maxHeight }}
          className="block h-auto w-auto max-w-full select-none"
        />
      ) : (
        <div
          style={{
            backgroundColor: state.backgroundColor,
            aspectRatio: BLANK_CANVAS_RATIO,
            maxHeight,
          }}
          className="w-full"
        />
      )}
      {children}
    </div>
  )
})
