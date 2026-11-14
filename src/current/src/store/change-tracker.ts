export class ChangeTracker {
  private readonly listeners = new Set<() => void>()
  private revision = 0
  private depth = 0
  private pending = false
  private disposed = false

  getRevision(): number {
    return this.revision
  }

  subscribe(listener: () => void): () => void {
    if (this.disposed) return () => {}
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispose(): void {
    this.disposed = true
    this.pending = false
    this.listeners.clear()
  }

  batch<Result>(callback: () => Result): Result {
    this.depth += 1
    try {
      return callback()
    } finally {
      this.depth -= 1
      this.flush()
    }
  }

  publish(): void {
    if (this.disposed) return
    this.pending = true
    this.flush()
  }

  private flush(): void {
    if (!this.pending || this.depth > 0) return
    this.pending = false
    this.revision += 1
    this.listeners.forEach((listener) => listener())
  }
}
