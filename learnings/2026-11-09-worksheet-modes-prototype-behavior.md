# Worksheet modes prototype — behavioral specification

**Reference:** [`src/2026-11-09-second-attempt-with-pi/`](../src/2026-11-09-second-attempt-with-pi/). This specifies observable behavior of that prototype, not its internal architecture or a future production editor. Earlier [prototype goals](./2026-08-31-editor-prototype-goals.md) and [worksheet document decision](./2026-10-25-how-to-implement-multimode.md) provide context; features proposed there but absent here are **not** requirements of this prototype.

## Purpose and scope

Demonstrate one worksheet whose authored **content**, learner **answers**, and assessment **feedback** are separate documents. Display same worksheet in four modes, each with at most one editable document. Provide local, single-user demonstration with a visible document inspector. Preserve edits across mode changes according to reset rules below. No network, multi-user session, student accounts, persistence across page reloads, or authorization system is required.

## Screen and initial state

- Page language and primary interface labels are German. Page title: `Arbeitsblatt · Inhalt, Antworten und Feedback`; heading: `Ein Arbeitsblatt · drei Dokumente`.
- Header contains four directly selectable mode buttons in order: `1. Inhalt bearbeiten`, `2. Aufgaben lösen`, `3. Feedback geben`, `4. Feedback ansehen`. Active button is visually distinguished and exposed as pressed. User may jump directly between any two modes; selecting current mode changes nothing.
- Desktop screen has two columns: left contains one worksheet editor (`Editor 1`), right contains `Inhalt · Antworten · Feedback` inspector. Narrow screens stack these regions. Inspector stays visible in all modes.
- Start in **Inhalt bearbeiten**, with no answers and no exercise feedback. Worksheet has three items in this order:
  1. Editable introductory text: `This is an example of educational content with various types of items.`
  2. Fill-in-the-gap sentence: `The capital of France is Paris.`; `Paris` is marked as gap and is correct answer.
  3. Multiple-choice question `What is 2 + 2?` with options `3`, `4`, `5` in that order. Only `4` is marked correct.
- Inspector displays current editability (`Bearbeitbar` or `Schreibgeschützt`) for all three documents and an expandable, pretty-printed JSON view for each. Changes to editable data become visible in corresponding JSON view. Inspector warns that JSON includes solutions and read-only behavior is not access control. Inspector is for debugging, not a student-safe presentation.

## Document and mode rules

| Mode              | Editable document | Worksheet presentation                                                                                                     |
| ----------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Inhalt bearbeiten | Content           | Edit authored text, gap-marked text, question, options, and correct-option flags. No learner answers or assessment shown.  |
| Aufgaben lösen    | Answers           | Authored content is fixed. Enter gap responses and select any combination of multiple-choice options. No assessment shown. |
| Feedback geben    | Feedback          | Authored content and learner responses fixed. Review responses; edit exercise ratings/comments and overall comment.        |
| Feedback ansehen  | None              | View authored content, responses, and available feedback without editing.                                                  |

- Edits to a non-editable document must not change it, including edits attempted through its rich text or controls. Non-editable text is displayed as static content; gap inputs and option checkboxes are disabled in both feedback modes.
- Each exercise retains an identity across mode changes so its answer and feedback remain associated with that exercise. Each multiple-choice option and each authored gap likewise keeps its answer association across changes of mode. Editing existing content does not give existing units new identities.
- Mode changes preserve current contents of all documents except for deliberate downstream resets:

| Selected destination | Content after switch | Answers after switch | Feedback after switch |
| -------------------- | -------------------- | -------------------- | --------------------- |
| Inhalt bearbeiten    | Preserve             | Clear                | Clear                 |
| Aufgaben lösen       | Preserve             | Preserve             | Clear                 |
| Feedback geben       | Preserve             | Preserve             | Preserve              |
| Feedback ansehen     | Preserve             | Preserve             | Preserve              |

- Reset depends on **destination**, not previous mode. Switching from feedback view to answering preserves answers but clears ratings and comments. Switching to content preserves authored edits but clears answers and feedback. Switching to feedback view does not clear anything. Re-entering feedback authoring after a reset generates fresh automatic exercise ratings; old comments and manual overrides do not return.
- Nothing in mode navigation submits a form or requires a save action. Session state lasts while page is open; reload may return to initial fixture.

## Content authoring

- Text item supports editable rich text with bold, italic, paragraphs, headings, and lists.
- Gap exercise supports editable paragraph text with bold, italic, and a gap mark. An author can select text and invoke `Gap` in formatting toolbar (also `Mod-Alt-g`) to mark or unmark a gap. Marked text is visually distinct and is treated as solution text in later modes. Gap identity survives document snapshots and mode switches.
- Multiple-choice authoring provides editable inline-rich-text question and each option text, with bold/italic formatting. Each option has a `Richtig`/`Falsch` checkbox for the author to set its correctness independently. Multiple options may be correct.
- A formatting toolbar appears only in content and feedback-authoring modes. It offers bold and italic for focused applicable rich-text field; gap command appears only when focused field supports gaps. Buttons indicate active/disabled state as appropriate.
- Initial three items and three multiple-choice options are fixed in this demo: no visible controls to insert, delete, or reorder worksheet items or options. Do not invent these controls to satisfy this specification.

## Learner answers

- Text and multiple-choice prompts display authored formatting but cannot be edited.
- In gap exercise, each marked gap is replaced by an individually labeled text input at its position in sentence. Typing preserves input focus and cursor. Empty gaps display empty inputs; previously entered responses reappear after leaving and returning to answering, unless answers were cleared by switching to content.
- In multiple-choice exercise, each option displays a learner checkbox, independently toggleable. Learner selections are separate from author-set correctness flags; author choices are not revealed as correctness controls in this mode. Selected options reappear on return to answering unless answers were cleared.
- Opening answering mode makes editable answer state available for displayed exercises, even before learner types. Opening feedback directly without first answering must still work; do not create stored learner answers merely to grade skipped exercises.
- No check/submit button or in-answering feedback is present.

## Feedback and grading

- On first displaying an exercise in **Feedback geben** when it has no assessment yet, supply an automatic rating from current authored solution and learner answer. Do not overwrite existing exercise assessment when revisiting feedback authoring without a reset. If user never answered, grade using empty responses; answer document remains unmodified.
- Fill-in-the-gap rating:
  - `Noch nicht bewertet` if exercise has no marked gaps.
  - `Richtig` only if **all** marked gaps have nonempty answers matching their authored solution text. Compare after trimming ends, collapsing internal whitespace, and case-insensitive comparison using German locale. Otherwise `Falsch`.
- Multiple-choice rating:
  - `Noch nicht bewertet` if there are no options.
  - `Richtig` if selected/unselected state of **every** option exactly matches its authored correct/incorrect state; otherwise `Falsch`. Thus unselected incorrect options are correct decisions; unanswered question with a required correct option is incorrect.
- Each exercise feedback panel in feedback-authoring mode shows current effective rating, a `Bewertung` selector, and editable rich-text `Kommentar`. Selector offers `Automatisch: <automatic rating>`, `Noch nicht bewertet`, `Richtig`, `Teilweise richtig`, `Falsch`. Selecting an explicit rating overrides displayed automatic rating; selecting automatic again restores automatic rating. Comments support bold/italic, paragraphs, and lists.
- A separate editable `Gesamtfeedback` rich-text comment appears below worksheet in feedback-authoring mode. No aggregate score or computed overall rating is displayed.
- In **Feedback ansehen**, show effective exercise rating and nonempty comment without editing controls; show overall feedback only if its comment is nonempty. An exercise with no available feedback shows no panel. An unassessed exercise with empty comment also shows no panel. Answers remain visible but disabled. Outside feedback-authoring mode, any nonempty overall comment may also be shown if feedback is still present; destination reset rules normally remove it on return to answering/content.

## Acceptance journeys

1. Edit introductory text and an option's correctness in content mode; switch to answering. Authored changes remain visible but not editable.
2. Enter `Paris` in gap and select only `4`; switch to feedback authoring. Both exercises show `Richtig`. Add exercise and overall comments, then view feedback: comments and ratings remain visible, answers are disabled, and no rich-text editing surfaces remain.
3. From feedback view return to answering: `Paris` and selected `4` remain, feedback panels disappear, feedback document is cleared. Re-enter feedback authoring: automatic `Richtig` ratings reappear, old comments/overrides do not.
4. From feedback or answering return to content: authored edits remain, answers and feedback clear. Enter answering again: gap empty, learner option selections off. Enter feedback directly: both fixture exercises grade `Falsch` without writing learner answers.
5. From initial page jump straight to feedback authoring: both unanswered exercises grade `Falsch`; answer document remains empty. Jump to feedback view: ratings visible, answer controls disabled.
6. Select already-active mode: no content, answer, or feedback changes.

## Deliberate limits

This is one local worksheet, not full Serlo Editor public API. No free-form exercise, item/option management UI, learner roster, grading submission, persistent save/load UI, migration, cross-document atomic save, solution secrecy, remote collaboration, or production authorization. Inspector exposes solutions, so do not present it as learner-safe. Preserve specified behavior without requiring any particular framework, schema design, storage backend, editor engine, or mode-switch mechanism.
