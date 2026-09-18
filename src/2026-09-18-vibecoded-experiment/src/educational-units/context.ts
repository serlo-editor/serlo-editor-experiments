export type Answers = Record<string, readonly number[] | string>

export type JourneyState = {
  readonly currentCard: number
  readonly completed: boolean
  next(): void
  restart(): void
  select(card: number): void
}

export type ViewContext = {
  readonly answers: Answers
  readonly checked: boolean
  readonly journey: JourneyState | null
  add(parentId: string, index: number): void
  check(): void
  delete(id: string): void
  edit(id: string): void
  choose(id: string, choice: number, selected: boolean): void
  write(id: string, answer: string): void
}
