export type Answers = Record<string, readonly number[] | string>

export type ViewContext = {
  readonly answers: Answers
  readonly checked: boolean
  add(index: number): void
  check(): void
  delete(id: string): void
  edit(id: string): void
  choose(id: string, choice: number, selected: boolean): void
  write(id: string, answer: string): void
}
