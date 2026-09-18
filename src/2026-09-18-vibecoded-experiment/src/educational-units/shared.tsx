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

export function Feedback({
  checked,
  correct,
  answer,
}: {
  checked: boolean
  correct: boolean
  answer?: string
}) {
  return checked ? (
    <div className="feedback">
      <p className={correct ? "success" : "error"}>{correct ? "Correct" : "Try again"}</p>
      {answer && <p>Answer: {answer}</p>}
    </div>
  ) : null
}

export function DeleteButton({ onDelete }: { onDelete(): void }) {
  return (
    <button type="button" className="delete-button" onClick={onDelete}>
      Delete unit
    </button>
  )
}
