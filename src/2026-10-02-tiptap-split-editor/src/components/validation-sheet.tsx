import { ArrowRightCircle, CheckCheck, RotateCcw } from "lucide-react"

import { cn } from "@/utils/cn"

import { statusBackground, statusBorder, type ValidationStatus } from "./validation-status"

/**
 * Bottom sheet of the preview pane. Slides in as soon as an answer is
 * selected and switches its style once the answer has been checked.
 */
export function ValidationSheet({
  isVisible,
  status,
  onCheck,
  onRetry,
  checkLabel = "Überprüfen",
  isCheckDisabled = false,
}: {
  isVisible: boolean
  status: ValidationStatus
  onCheck: () => void
  onRetry: () => void
  /** label of the button that hands in the answer */
  checkLabel?: string
  /** the answer is not ready yet, e.g. it is still too short */
  isCheckDisabled?: boolean
}) {
  return (
    <div
      aria-hidden={!isVisible}
      className={cn(
        "absolute inset-x-0 bottom-0 border-t transition-[transform,background-color,border-color] duration-300 ease-out motion-reduce:transition-none",
        isVisible ? "translate-y-0" : "pointer-events-none translate-y-full",
        (status === "unchecked" || status === "retry") && "border-neutral-300 bg-neutral-100",
        status === "incorrect" && cn(statusBorder.incorrect, statusBackground.incorrect),
        (status === "correct" || status === "submitted") &&
          cn(statusBorder.correct, statusBackground.correct),
      )}
    >
      <div className="flex flex-col items-center gap-3 px-6 py-6">
        {status !== "unchecked" && (
          <p role="status" aria-live="polite" className="text-xl text-neutral-900">
            {status === "correct" && "🥳 Genau richtig!"}
            {status === "submitted" && "🥳 Danke für deine Antwort!"}
            {status === "incorrect" && "🐸 Das stimmt leider noch nicht ganz"}
            {status === "retry" && "Viel Erfolg!"}
          </p>
        )}

        {status === "unchecked" && (
          <SheetButton icon={CheckCheck} onClick={onCheck} isDisabled={isCheckDisabled}>
            {checkLabel}
          </SheetButton>
        )}
        {status === "incorrect" && (
          <SheetButton icon={RotateCcw} onClick={onRetry}>
            Nochmal Probieren
          </SheetButton>
        )}
        {(status === "correct" || status === "submitted") && (
          <SheetButton icon={ArrowRightCircle} iconPosition="end">
            Weiter
          </SheetButton>
        )}
      </div>
    </div>
  )
}

function SheetButton({
  icon: Icon,
  iconPosition = "start",
  onClick,
  isDisabled = false,
  children,
}: {
  icon: typeof CheckCheck
  iconPosition?: "start" | "end"
  onClick?: () => void
  isDisabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className="inline-flex items-center gap-2 rounded-full bg-[#4C60BA] px-5 py-2 text-lg font-bold text-white transition-colors hover:bg-[#3E4F9E] disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500 disabled:hover:bg-neutral-300"
    >
      {iconPosition === "start" && <Icon className="h-5 w-5" />}
      {children}
      {iconPosition === "end" && <Icon className="h-5 w-5" />}
    </button>
  )
}
