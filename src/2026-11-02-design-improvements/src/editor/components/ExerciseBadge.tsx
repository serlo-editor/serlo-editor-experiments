export function ExerciseBadge({ label, help }: { label: string; help: string }) {
  return (
    <span className="exercise-badge">
      {label}
      <span className="exercise-badge__help" role="img" aria-label={help} title={help}>
        ?
      </span>
    </span>
  )
}
