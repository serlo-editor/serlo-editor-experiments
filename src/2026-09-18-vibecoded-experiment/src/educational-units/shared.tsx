export function UnitHead({
  name,
  onDelete,
  onEdit,
}: {
  name: string
  onDelete(): void
  onEdit(): void
}) {
  return (
    <div className="unit-head">
      <span>{name}</span>
      <div className="unit-actions">
        <button type="button" onClick={onEdit}>
          Edit
        </button>
        <button type="button" className="delete" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  )
}

export function AddUnitButton({ onClick }: { onClick(): void }) {
  return (
    <button type="button" className="add-unit" onClick={onClick}>
      + Add unit
    </button>
  )
}

export function Feedback({ checked, correct }: { checked: boolean; correct: boolean }) {
  return checked ? (
    <p className={`feedback ${correct ? "success" : "error"}`}>
      {correct ? "Correct" : "Try again"}
    </p>
  ) : null
}

export function DeleteButton({ onDelete }: { onDelete(): void }) {
  return (
    <button type="button" className="delete-button" onClick={onDelete}>
      Delete unit
    </button>
  )
}
