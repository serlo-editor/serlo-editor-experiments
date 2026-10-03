import { useCallback, useEffect, useRef, useState } from "react"

import { cn } from "@/utils/cn"

const MIN_PERCENT = 20
const MAX_PERCENT = 80

export function SplitPane({
  left,
  right,
  initialPercent = 52,
  className,
}: {
  left: React.ReactNode
  right: React.ReactNode
  initialPercent?: number
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [percent, setPercent] = useState(initialPercent)
  const [isDragging, setIsDragging] = useState(false)

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    event.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    function onPointerMove(event: PointerEvent) {
      const container = containerRef.current
      if (!container) return
      const { left: offsetLeft, width } = container.getBoundingClientRect()
      const next = ((event.clientX - offsetLeft) / width) * 100
      setPercent(Math.min(MAX_PERCENT, Math.max(MIN_PERCENT, next)))
    }
    function onPointerUp() {
      setIsDragging(false)
    }

    window.addEventListener("pointermove", onPointerMove)
    window.addEventListener("pointerup", onPointerUp)
    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
    }
  }, [isDragging])

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex h-full w-full overflow-hidden",
        isDragging && "cursor-col-resize select-none",
        className,
      )}
    >
      <div className="relative h-full overflow-y-auto" style={{ width: `${percent}%` }}>
        {left}
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(percent)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") setPercent((p) => Math.max(MIN_PERCENT, p - 2))
          if (event.key === "ArrowRight") setPercent((p) => Math.min(MAX_PERCENT, p + 2))
        }}
        className={cn(
          "group relative w-px shrink-0 cursor-col-resize bg-neutral-900 outline-none",
          isDragging && "bg-neutral-500",
        )}
      >
        {/* widen the hit area without widening the visual line */}
        <div className="absolute inset-y-0 -left-2 -right-2" />
      </div>

      <div
        className="relative h-full flex-1 overflow-y-auto"
        style={{ width: `${100 - percent}%` }}
      >
        {right}
      </div>
    </div>
  )
}
