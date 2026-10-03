import { useRef } from "react"

import { cn } from "@/utils/cn"

/** movement above this is a drag, below it a tap that clicks through */
const DRAG_THRESHOLD_PX = 6

/**
 * The closest element between the pointer and the container that scrolls
 * sideways — an image gallery, a wide table —, which a sideways drag moves
 * instead of scrolling the container itself.
 */
function sidewaysScroller(target: EventTarget | null, container: HTMLElement): HTMLElement | null {
  let element = target instanceof Element ? target : null
  while (element && element !== container) {
    if (
      element instanceof HTMLElement &&
      element.scrollWidth > element.clientWidth &&
      /auto|scroll/.test(getComputedStyle(element).overflowX)
    )
      return element
    element = element.parentElement
  }
  return null
}

/**
 * Scroll container that can also be scrolled by dragging with the pointer,
 * simulating touch scrolling on a device mock-up: up and down, and sideways
 * where the drag starts on something that scrolls that way (see
 * `sidewaysScroller`). The direction of the gesture picks which one it is.
 * Taps still click, a drag swallows the click that would otherwise fire on
 * release.
 */
export function DragScrollArea({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    pointerId: number
    startX: number
    startY: number
    startScrollTop: number
    /** what a sideways drag would scroll, and where it stands */
    sideways: HTMLElement | null
    startScrollLeft: number
    moved: boolean
    isSideways: boolean
  } | null>(null)

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.pointerType === "touch") return
    const element = ref.current
    if (!element) return
    const sideways = sidewaysScroller(event.target, element)
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollTop: element.scrollTop,
      sideways,
      startScrollLeft: sideways?.scrollLeft ?? 0,
      moved: false,
      isSideways: false,
    }
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const current = drag.current
    const element = ref.current
    if (!current || !element || current.pointerId !== event.pointerId) return
    const deltaX = current.startX - event.clientX
    const deltaY = current.startY - event.clientY
    if (!current.moved && Math.max(Math.abs(deltaX), Math.abs(deltaY)) < DRAG_THRESHOLD_PX) return
    if (!current.moved) {
      current.moved = true
      // the way the drag started is the way it goes on, so a gallery does not
      // hand the gesture back to the page halfway through
      current.isSideways = !!current.sideways && Math.abs(deltaX) > Math.abs(deltaY)
      // keeps the scroll going when the pointer leaves the device screen
      element.setPointerCapture(event.pointerId)
    }
    if (current.isSideways && current.sideways)
      current.sideways.scrollLeft = current.startScrollLeft + deltaX
    else element.scrollTop = current.startScrollTop + deltaY
  }

  function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current || current.pointerId !== event.pointerId) return
    // keep `moved` around until the click that follows pointerup is handled
    if (!current.moved) drag.current = null
  }

  // pictures and links come with a native drag of their own, which would take
  // the gesture away as soon as it starts on one of them
  function onDragStart(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
  }

  function onClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (!drag.current?.moved) return
    event.preventDefault()
    event.stopPropagation()
    drag.current = null
  }

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDragStart={onDragStart}
      onClickCapture={onClickCapture}
      className={cn(
        "overflow-y-auto overscroll-contain cursor-grab select-none active:cursor-grabbing",
        className,
      )}
    >
      {children}
    </div>
  )
}
