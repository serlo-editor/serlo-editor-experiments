# Worksheet modes with separate documents

Reimplements `2026-10-24-designed-prototype-with-new-storage` with independent
content, answer, and feedback documents. Storage/schema core comes from
`2026-10-05-new-storage-for-prototype`. Source experiments remain unchanged.

## Run and check

```sh
bun dev
bun run fix
bun run build
```

## Try the workflow

1. **Inhalt bearbeiten:** edit rich text, mark gaps, and set correct choices.
   Two teacher peers synchronize content and editor-scoped awareness through Yjs.
   Right pane switches between collaboration and document JSON.
2. **Aufgaben lösen:** fill gaps and choose answers.
   Content is a read-only snapshot; only the answer document is writable.
   Answers persist across mode switches.
3. **Feedback geben:** inspect frozen answers and automatic right/wrong assessments.
   Override assessments when needed; write rich-text comments and overall feedback
   using the formatting toolbar. Only the feedback document is writable.
4. **Feedback ansehen:** view own answers and feedback with every document read-only.

| Mode             | Content   | Answers      | Feedback     |
| ---------------- | --------- | ------------ | ------------ |
| Authoring        | Yjs       | Not provided | Not provided |
| Answering        | Read-only | Flat         | Read-only    |
| Adding feedback  | Read-only | Read-only    | Flat         |
| Viewing feedback | Read-only | Read-only    | Read-only    |

The demo uses one student with separate answer and feedback stores.
Document roles are worksheet properties, not storage node kinds or schema
metadata. `bindDocument()` accepts any supported backend independently; demo uses
Flat for responses. Each logical document needs its own store/root; independently
synchronized Yjs documents need separate `Y.Doc`s.

## Structure

- `src/editor/worksheet.ts`: worksheet composition, student documents, mode bindings.
- `src/editor/documents.ts`: backend-neutral document binding.
- `src/editor/responses.ts`: answer/feedback schemas and targeted field updates.
- `src/editor/grading.ts`: automatic gap and multiple-choice assessments.
- `src/editor/content/`: text, gap, and multiple-choice block definitions/renderers.
- `src/editor/worksheet-context.ts`: application context joining documents for renderers.
- `src/editor/components/`: generic `BlockView` dispatch plus mode-aware interactions,
  toolbar, serialized content views, and feedback fields.
- `src/editor/session.ts`: collaborative content/awareness lifetime.
- `src/editor/storage/`, `schema/`, `rich-text/`: independent backend/schema core.
- `src/demo/`: two teacher replicas, one student, mode controls, document inspector.

Content drives traversal in every mode, including exercises with no answer yet.
Renderers read worksheet context and resolve responses through content block IDs.
Answer and feedback record keys are content IDs; response blocks have their own
IDs and distinct variants. Multiple-choice options carry explicit `optionId`s;
gap marks carry persistent IDs. Neither rich-text editor IDs nor array indices
are used as cross-document response references.

Missing answers are created on interaction; exercise feedback is initialized on
entry into feedback mode, never during render. Subsequent interactions edit existing
children rather than replacing entire answer blocks. React subscribes to all provided stores. Gap DOM updates preserve focus
and selection while answers change; read-only content is serialized without
mounting additional ProseMirror views.

## Automatic grading and rich-text feedback

Entering feedback mode refreshes automatic assessments. Gap solutions come from
text carrying the same gap ID, including text split by formatting marks. Comparison
ignores letter case and leading/trailing/repeated whitespace; every gap must match.
Multiple choice requires every current option's selected state to match its
`isCorrect` flag. Missing answers are incorrect; exercises without gaps/options
remain unassessed. Removed answer keys are ignored.

Automatic results and manual overrides are stored separately. Switching modes or
regrading preserves comments and overrides; selecting **Automatisch** restores the
automatic assessment. Exercise comments and overall feedback store ProseMirror JSON,
including bold/italic formatting and lists. Viewing mode serializes that formatting
without mounting editable views.

## Lifetime and limits

Writable documents live for app session. Mode entry snapshots every document that
must be read-only into a fresh `ReadonlyNodeStore`; this is not a live mirror.
Returning to another mode takes new snapshots and preserves writable source data.
Read-only backends reject writes even through programmatic schema methods.
Teacher sessions disconnect transport, unmount views, and destroy awareness/Yjs
documents on teardown. Read-only view caches become collectible with their mode.
No generic backend disposal or unused-fragment garbage collection is added.

Content edits after answering do not migrate existing responses. Unchanged IDs
retain associations after sibling edits. Removed exercise/option/gap responses
remain stored but are not rendered; semantic changes under an existing ID can
make responses stale. Publication/versioning, stale-response policy, copy/paste ID
normalization, submissions, analytics UI, durable persistence, network providers,
and cross-document atomic transactions are outside this prototype.

Mode restrictions and read-only storage prevent unintended edits, not unauthorized
access. Debug JSON intentionally includes solutions and must not be exposed as a
student-facing authorization boundary. Grading is deterministic and local; no
alternative gap solutions, semantic matching, or scoring model is implemented.

`worksheet.spec.ts` checks real store boundaries, collaborative teacher edits,
response isolation, identities, mode round trips, and student separation. Existing
schema/storage suites cover the shared backend APIs.
