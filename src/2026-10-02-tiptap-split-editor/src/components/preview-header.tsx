import { RotateCcw } from "lucide-react"

export function PreviewHeader({ onReset }: { onReset: () => void }) {
  return (
    <div className="mb-10 flex items-center gap-3">
      <h2 className="text-lg font-bold text-neutral-900">Vorschau</h2>
      <button
        type="button"
        onClick={onReset}
        aria-label="Vorschau zurücksetzen"
        title="Vorschau zurücksetzen"
        className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-neutral-700 transition-colors hover:bg-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
    </div>
  )
}
