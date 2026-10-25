# ADR: Separate Worksheet Documents by Responsibility

**Status:** Accepted  
**Date:** 2026-10-25

## Context

A worksheet contains teacher-authored content, student answers, and feedback.

These data categories have different requirements depending on the editor mode:

- **Authoring:** Teachers edit content.
- **Filling out:** Students edit answers without modifying content.
- **Adding feedback:** Teachers review answers and add feedback.
- **Viewing feedback:** Students view their answers and associated feedback.

The editor supports multiple storage backends, including Yjs for collaborative editing, flat storage, and read-only storage.

Storing all data in one document couples their storage behavior and makes it harder to enforce editing restrictions.

Additionally, teachers need to aggregate answers from multiple students for learning analytics and feedback.

## Decision

A worksheet consists of multiple independent documents, separated by responsibility:

- **Content document:** Teacher-authored worksheet structure and exercise definitions.
- **Answer document:** Student responses.
- **Feedback document:** Assessment results, overall feedback, and comments on student answers.

Each document has its own storage backend, selected independently based on the editor mode and application requirements.

The worksheet combines these documents into a unified view.

### Example API

```ts
type Worksheet = {
  content: Document<Content>
  answer: Document<Answers>
  feedback: Document<Feedback>
}
```

Different modes can use different storage configurations:

| Mode             | Content   | Answer     | Feedback   |
| ---------------- | --------- | ---------- | ---------- |
| Authoring        | Yjs       | —          | —          |
| Filling out      | Read-only | Yjs / Flat | Read-only  |
| Adding feedback  | Read-only | Read-only  | Yjs / Flat |
| Viewing feedback | Read-only | Read-only  | Read-only  |

The application controls which documents are provided and which storage backends they use.

Documents reference worksheet units through stable identifiers.

### Multiple students

The same content document can be combined with different students' answer and feedback documents.

```ts
const worksheet = {
  content,
  students: [
    { answers: aliceAnswers, feedback: aliceFeedback },
    { answers: bobAnswers, feedback: bobFeedback },
  ],
}
```

This allows teachers to inspect multiple students' work, provide feedback, and compute learning analytics without duplicating shared content.

## Consequences

### Advantages

- **Independent storage:** Each document can use Yjs, flat, or read-only storage.
- **Editing isolation:** Students cannot accidentally modify content through their answer document.
- **Collaboration:** Different document types can have different synchronization requirements.
- **Reuse:** Content can be shared across multiple students and attempts.
- **Learning analytics:** Answers from multiple students can be aggregated independently of content.
- **Separation of concerns:** Content, answers, and feedback have independent lifecycles.

### Disadvantages

- **Additional complexity:** Worksheet rendering requires combining multiple documents.
- **Cross-document references:** Stable unit identifiers are necessary to associate answers and feedback with content.
- **Consistency:** Changes to content can invalidate existing answers or feedback.
- **Transactions:** Atomic changes across multiple documents are not automatically supported.
- **Lifecycle management:** Document creation, loading, and disposal must be coordinated.

## Alternatives Considered

### Single document with colocated state

Store content, answers, and feedback directly within each worksheet unit.

**Rejected:** Couples independently editable data and makes different storage backends per responsibility difficult.

### Single document with separate sections

Store content, answers, and feedback in separate top-level sections of one document.

**Rejected:** Provides logical separation but does not allow independent document-level storage backends or synchronization boundaries.

## Notes

- Rendering remains independent of storage backend.
- The editor mode determines available interactions; storage capabilities provide an additional boundary against unintended modifications.
- Storage-level read-only behavior does not replace application-level authorization.
- The exact schemas for answers, submissions, and feedback are separate architectural decisions.
- Learning analytics can aggregate multiple answer documents without changing their underlying storage model.
