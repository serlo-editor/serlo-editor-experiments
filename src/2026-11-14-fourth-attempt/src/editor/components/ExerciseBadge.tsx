import styles from "./ExerciseBadge.module.css"

export function ExerciseBadge({ label, help }: { label: string; help: string }) {
  return (
    <span className={styles.badge}>
      {label}
      <span className={styles.help} role="img" aria-label={help} title={help}>
        ?
      </span>
    </span>
  )
}
