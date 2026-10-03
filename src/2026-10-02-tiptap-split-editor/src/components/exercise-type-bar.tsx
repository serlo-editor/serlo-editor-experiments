import { exerciseTypes, type ExerciseType } from "@/blocks/exercise-types"

export function ExerciseTypeBar({
  value,
  onChange,
}: {
  value: ExerciseType
  onChange: (type: ExerciseType) => void
}) {
  return (
    <nav
      aria-label="Aufgabentyp"
      className="flex h-12 shrink-0 items-center gap-1 border-b border-neutral-900 bg-white px-4"
    >
      <span className="mr-3 text-sm text-neutral-500">Aufgabentyp</span>
      {exerciseTypes.map(({ id, label }) => {
        const active = id === value
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(id)}
            className={
              active
                ? "rounded-lg bg-[#8F9AD6] px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-lg px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
            }
          >
            {label}
          </button>
        )
      })}
    </nav>
  )
}
