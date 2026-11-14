import type { RichTextJSON } from "@editor/rich-text"
import type { StoredRichText } from "@editor/schema/rich-text"
import { FlatNodeStore } from "@editor/store"
import { openWorksheet, WorksheetMode } from "@editor/worksheet"
import { toggleMark, type NodeJSON } from "prosekit/core"
import { createElement } from "react"
import { useLayoutEffect, useState, useSyncExternalStore, type ReactNode } from "react"

import {
  answersSchema,
  contentSchema,
  feedbackSchema,
  grade,
  initialAnswers,
  initialContent,
  initialFeedback,
} from "./worksheet"

const modes = [
  { id: WorksheetMode.EditingContent, label: "1. Inhalt bearbeiten" },
  { id: WorksheetMode.Answering, label: "2. Aufgaben lösen" },
  { id: WorksheetMode.GivingFeedback, label: "3. Feedback geben" },
  { id: WorksheetMode.ViewingFeedback, label: "4. Feedback ansehen" },
]
const ratings: Record<string, string> = {
  unrated: "Noch nicht bewertet",
  correct: "Richtig",
  partial: "Teilweise richtig",
  incorrect: "Falsch",
}
type Snapshot = {
  content: typeof initialContent
  answers: typeof initialAnswers
  feedbacks: typeof initialFeedback
}

function open(mode: WorksheetMode, snapshot: Snapshot) {
  return openWorksheet({
    mode,
    createStore: () => new FlatNodeStore(),
    contentSchema,
    answersSchema,
    feedbacksSchema: feedbackSchema,
    initialSnapshot: snapshot,
  })
}
type Session = ReturnType<typeof open>

export default function App() {
  const [session, setSession] = useState(() =>
    open(WorksheetMode.EditingContent, {
      content: initialContent,
      answers: initialAnswers,
      feedbacks: initialFeedback,
    }),
  )
  useSyncExternalStore(session.subscribe, session.getRevision, session.getRevision)
  const [active, setActive] = useState<{ field: StoredRichText; gap: boolean } | null>(null)
  const { content, answers, feedbacks, mode } = session
  const authoring = mode === WorksheetMode.EditingContent
  const reviewing = mode === WorksheetMode.GivingFeedback
  const answering = mode === WorksheetMode.Answering
  const answerSnapshot = answers.snapshot()
  const feedbackSnapshot = feedbacks.snapshot()
  const contentSnapshot = content.snapshot()
  const toolbarCommands: ("bold" | "italic" | "gap")[] = active?.gap
    ? ["bold", "italic", "gap"]
    : ["bold", "italic"]

  function switchMode(next: WorksheetMode) {
    if (next === mode) return
    const snapshot: Snapshot = {
      content: content.snapshot(),
      answers: next === WorksheetMode.EditingContent ? initialAnswers : answers.snapshot(),
      feedbacks:
        next === WorksheetMode.EditingContent || next === WorksheetMode.Answering
          ? initialFeedback
          : feedbacks.snapshot(),
    }
    if (next === WorksheetMode.GivingFeedback) {
      const exercises = { ...snapshot.feedbacks.exercises }
      for (const [id, automatic] of Object.entries(grade(snapshot.content, snapshot.answers))) {
        exercises[id] ??= {
          automatic,
          override: "",
          comment: feedbackSchema.defaultValue().overall,
        }
      }
      snapshot.feedbacks = { ...snapshot.feedbacks, exercises }
    }
    setActive(null)
    setSession(open(next, snapshot))
    // Old editor instances remain mounted until React removes their hosts. Disposal follows unmount.
    queueMicrotask(() => session.dispose())
  }

  function answerGap(id: string, value: string) {
    answers.gaps.getOrCreate(id, () => "").set(value)
  }
  function answerChoice(id: string, value: boolean) {
    answers.choices.getOrCreate(id, () => false).set(value)
  }

  return (
    <main className="app">
      <header className="app__header">
        <h1>Ein Arbeitsblatt · drei Dokumente</h1>
        <nav className="app__view-switch" aria-label="Arbeitsmodus">
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={mode === item.id}
              onClick={() => switchMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>
      <div className="app__workspace">
        <section className="app__authoring" aria-label="Aktiver Arbeitsbereich">
          <div className="editor-card">
            <h2>Editor 1</h2>
            {(authoring || reviewing) && (
              <div className="toolbar" role="toolbar" aria-label="Formatierung">
                {toolbarCommands.map((command) => (
                  <button
                    key={command}
                    type="button"
                    disabled={!active}
                    aria-pressed={
                      !!active &&
                      active.field
                        .getEditor()
                        .state.selection.$from.marks()
                        .some((mark) => mark.type.name === command)
                    }
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      if (!active) return
                      active.field.getEditor().exec(
                        toggleMark({
                          type: command,
                          ...(command === "gap" ? { attrs: { id: crypto.randomUUID() } } : {}),
                        }),
                      )
                      active.field.getEditor().focus()
                    }}
                  >
                    {command === "bold" ? "Fett" : command === "italic" ? "Kursiv" : "Gap"}
                  </button>
                ))}
              </div>
            )}
            <div className="worksheet">
              <section className="exercise exercise--text">
                {authoring ? (
                  <Editable
                    field={content.intro.body}
                    onFocus={() => setActive({ field: content.intro.body, gap: false })}
                  />
                ) : (
                  <Static doc={contentSnapshot.intro.body} />
                )}
              </section>
              <section className="exercise exercise--fill-blank">
                <h3>Lückentext</h3>
                {authoring ? (
                  <Editable
                    field={content.gap.body}
                    onFocus={() => setActive({ field: content.gap.body, gap: true })}
                  />
                ) : (
                  <Static
                    doc={contentSnapshot.gap.body}
                    gaps={answerSnapshot.gaps}
                    disabled={!answering}
                    onGap={answerGap}
                  />
                )}
                {(reviewing || mode === WorksheetMode.ViewingFeedback) && (
                  <FeedbackPanel
                    id={content.gap.id}
                    session={session}
                    feedback={feedbackSnapshot.exercises[content.gap.id]}
                    onFocus={setActive}
                  />
                )}
              </section>
              <section className="exercise exercise--choice">
                <h3>Multiple Choice</h3>
                {authoring ? (
                  <Editable
                    field={content.choice.question}
                    onFocus={() => setActive({ field: content.choice.question, gap: false })}
                  />
                ) : (
                  <Static doc={contentSnapshot.choice.question} />
                )}
                <ul className="multiple-choice-options">
                  {content.choice.options.children().map((option) => (
                    <li key={option.id.get()} className="choice-card">
                      {authoring ? (
                        <>
                          <Editable
                            field={option.body}
                            onFocus={() => setActive({ field: option.body, gap: false })}
                          />
                          <label>
                            <input
                              type="checkbox"
                              checked={option.correct.get()}
                              onChange={(event) => option.correct.set(event.target.checked)}
                            />
                            {option.correct.get() ? "Richtig" : "Falsch"}
                          </label>
                        </>
                      ) : (
                        <label>
                          <input
                            type="checkbox"
                            disabled={!answering}
                            checked={answerSnapshot.choices[option.id.get()] ?? false}
                            onChange={(event) =>
                              answerChoice(option.id.get(), event.target.checked)
                            }
                          />
                          <Static doc={option.body.snapshot()} />
                        </label>
                      )}
                    </li>
                  ))}
                </ul>
                {(reviewing || mode === WorksheetMode.ViewingFeedback) && (
                  <FeedbackPanel
                    id={content.choice.id}
                    session={session}
                    feedback={feedbackSnapshot.exercises[content.choice.id]}
                    onFocus={setActive}
                  />
                )}
              </section>
              {reviewing && (
                <section aria-label="Gesamtfeedback">
                  <h3>Gesamtfeedback</h3>
                  <Editable
                    field={feedbacks.overall}
                    onFocus={() => setActive({ field: feedbacks.overall, gap: false })}
                  />
                </section>
              )}
              {!reviewing && !authoring && !empty(feedbackSnapshot.overall) && (
                <section className="feedback-card">
                  <h3>Gesamtfeedback</h3>
                  <Static doc={feedbackSnapshot.overall} />
                </section>
              )}
            </div>
          </div>
        </section>
        <aside className="app__preview" aria-label="Dokumente">
          <h2>Inhalt · Antworten · Feedback</h2>
          <dl className="document-status">
            <dt>Inhalt</dt>
            <dd>{authoring ? "Bearbeitbar" : "Schreibgeschützt"}</dd>
            <dt>Antworten</dt>
            <dd>{answering ? "Bearbeitbar" : "Schreibgeschützt"}</dd>
            <dt>Feedback</dt>
            <dd>{reviewing ? "Bearbeitbar" : "Schreibgeschützt"}</dd>
          </dl>
          <p className="documents__note">
            Zurück zum Inhalt löscht Antworten und Feedback; zurück zu Aufgaben löscht Feedback.
          </p>
          {[
            ["Inhalt", contentSnapshot],
            ["Antworten", answerSnapshot],
            ["Feedback", feedbackSnapshot],
          ].map(([label, snapshot]) => (
            <details className="document-json" key={String(label)}>
              <summary>{String(label)} · JSON</summary>
              <pre>{JSON.stringify(snapshot, null, 2)}</pre>
            </details>
          ))}
          <p className="documents__note">
            Debug-Ansicht enthält auch Lösungen. Schreibschutz ist keine Zugriffskontrolle.
          </p>
        </aside>
      </div>
    </main>
  )
}

function FeedbackPanel({
  id,
  session,
  feedback,
  onFocus,
}: {
  id: string
  session: Session
  feedback: ReturnType<Session["feedbacks"]["snapshot"]>["exercises"][string] | undefined
  onFocus: (value: { field: StoredRichText; gap: boolean }) => void
}) {
  if (
    !feedback ||
    (session.mode !== WorksheetMode.GivingFeedback &&
      feedback.automatic === "unrated" &&
      !feedback.override &&
      empty(feedback.comment))
  )
    return null
  const rating = feedback.override || feedback.automatic
  const editable = session.mode === WorksheetMode.GivingFeedback
  const stored = editable ? session.feedbacks.exercises.getOrCreate(id, () => feedback) : null
  return (
    <div className="feedback-card" data-result={rating}>
      <strong>{ratings[rating]}</strong>
      {editable ? (
        <>
          <label>
            Bewertung{" "}
            <select
              value={feedback.override}
              onChange={(event) => stored?.override.set(event.target.value)}
            >
              <option value="">Automatisch: {ratings[feedback.automatic]}</option>
              {Object.entries(ratings).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>Kommentar</label>
          <Editable
            field={stored!.comment}
            onFocus={() => onFocus({ field: stored!.comment, gap: false })}
          />
        </>
      ) : (
        !empty(feedback.comment) && <Static doc={feedback.comment} />
      )}
    </div>
  )
}

function Editable({ field, onFocus }: { field: StoredRichText; onFocus: () => void }) {
  useLayoutEffect(() => {
    const element = document.getElementById(field.id)
    if (!element) return
    return field.getEditor().mount(element)
  }, [field.id])
  return <div className="editor-content" id={field.id} onFocusCapture={onFocus} />
}

function empty(doc: RichTextJSON): boolean {
  function hasText(node: NodeJSON): boolean {
    return !!node.text?.trim() || !!node.content?.some(hasText)
  }
  return !hasText(doc)
}

function Static({
  doc,
  gaps: responses,
  disabled,
  onGap,
}: {
  doc: RichTextJSON
  gaps?: Record<string, string>
  disabled?: boolean
  onGap?: (id: string, value: string) => void
}) {
  function renderChildren(nodes: NodeJSON[] = []): ReactNode[] {
    const result: ReactNode[] = []
    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index]!
      const gapId = node.marks?.find((mark) => mark.type === "gap")?.attrs?.id
      const previousId = nodes[index - 1]?.marks?.find((mark) => mark.type === "gap")?.attrs?.id
      if (gapId && gapId === previousId) continue
      if (node.type === "list") {
        const kind = node.attrs?.kind
        const items = [render(node, index)]
        while (nodes[index + 1]?.type === "list" && nodes[index + 1]?.attrs?.kind === kind)
          items.push(render(nodes[++index]!, index))
        result.push(createElement(kind === "ordered" ? "ol" : "ul", { key: index }, items))
      } else result.push(render(node, index))
    }
    return result
  }
  function render(node: NodeJSON, key: number | string): ReactNode {
    const gapId = node.marks?.find((item) => item.type === "gap")?.attrs?.id
    if (typeof gapId === "string" && responses)
      return (
        <input
          className="preview-gap"
          key={key}
          aria-label={`Lücke ${gapId}`}
          value={responses[gapId] ?? ""}
          disabled={disabled}
          onChange={(event) => onGap?.(gapId, event.target.value)}
        />
      )
    let child: ReactNode = node.text ?? renderChildren(node.content)
    for (const item of node.marks ?? [])
      child =
        item.type === "bold" ? (
          <strong>{child}</strong>
        ) : item.type === "italic" ? (
          <em>{child}</em>
        ) : (
          child
        )
    const tags: Record<string, string> = {
      paragraph: "p",
      heading: "h2",
      list: "li",
      inlineBlock: "span",
    }
    const Tag = tags[node.type] ?? "span"
    return createElement(Tag, { key }, child)
  }
  return <div className="preview-rich-text">{renderChildren(doc.content)}</div>
}
