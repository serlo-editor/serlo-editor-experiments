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

## Browser E2E tests

```sh
bun run test:e2e
```

Requires Bun 1.4.2+ with experimental [`Bun.WebView`](https://bun.com/docs/runtime/webview).
macOS uses system WebKit; Linux and Windows need Chrome, Chromium, Edge, or Brave.
Set `BUN_CHROME_PATH` if Bun cannot find your browser.

`e2e/worksheet.e2e.ts` builds self-contained HTML in a unique temporary directory
under `dist/`, opens fresh browser views, and cleans up afterward. Fixtures stay
inside the project because Snap browsers cannot see the host's `/tmp` directory.
No dev server, fixed port, or new test dependency is needed. Tests use native
clicks, typing, and key presses to cover:

- Collaborative content editing and answering, input focus, and document inspection.
- Automatic grading, manual overrides, formatted comments, overall feedback, and read-only viewing.
- Mode round trips, active-mode no-ops, and downstream resets on both Yjs peers.

Run separately from `bun test` / `bun run fix`, which remain browser-independent.

## Try the workflow

Every mode provides two synchronized Yjs peers. The right pane switches between
collaboration and document JSON; both peers work on the same student's attempt.

1. **Inhalt bearbeiten:** edit rich text, mark gaps, and set correct choices.
   Content and editor-scoped awareness synchronize through Yjs.
2. **Aufgaben lösen:** fill gaps and choose answers together. Only the answer
   document is writable; changes appear immediately in the other peer.
3. **Feedback geben:** inspect answers and automatic right/wrong assessments.
   Collaboratively override assessments and write rich-text comments and overall
   feedback using the formatting toolbar. Only the feedback document is writable;
   rich-text presence is scoped to the corresponding comment.
4. **Feedback ansehen:** both peers view answers and formatted feedback with
   every document read-only. All locked documents remain live views of their source.

Mode switches keep the selected mode's data and all earlier data, but clear
later documents on both peers:

- Returning to **Inhalt bearbeiten** clears answers and all feedback.
- Returning to **Aufgaben lösen** keeps answers and clears assessments, comments,
  and overall feedback.
- Switching between **Feedback geben** and **Feedback ansehen** keeps feedback.
- Clicking the already active mode changes nothing.

Re-entering feedback after a reset computes fresh automatic assessments.

| Mode             | Content       | Answers       | Feedback      |
| ---------------- | ------------- | ------------- | ------------- |
| Authoring        | Yjs writable  | Not provided  | Not provided  |
| Answering        | Yjs read-only | Yjs writable  | Yjs read-only |
| Adding feedback  | Yjs read-only | Yjs read-only | Yjs writable  |
| Viewing feedback | Yjs read-only | Yjs read-only | Yjs read-only |

The demo uses one attempt with separate answer and feedback stores.
Document roles are worksheet properties, not storage node kinds or schema
metadata. `bindDocument()` accepts any supported backend independently; the
worksheet receives a pair of answer/feedback bindings. The demo uses three
independent `Y.Doc` pairs, each with its own store, root, awareness, and
transport. Read-only bindings subscribe to the source store and cache
immutable projections per revision; they expose no writable source values.

## Structure

- `src/editor/worksheet-mode.ts`: mode values shared by worksheet and blocks.
- `src/editor/documents.ts`: backend-neutral binding and live read-only projections.
- `src/editor/schema/exercise.tsx`: exercise facade joins unit, answer, and feedback handles by unit ID when rendering.
- `src/editor/blocks/`: text, gap-fill, and multiple-choice definitions alongside renderers, styles, and block-specific answer/grading logic; `shared/` holds UI, fields, and styles used by both exercises.
- `src/editor/responses.ts`: answer/feedback document composition and feedback initialization.
- `src/editor/worksheet.ts`: worksheet composition, downstream resets, mode bindings, and automatic assessment traversal.
- `src/editor/worksheet-context.ts`: application context joining documents for renderers.
- `src/editor/components/`: reusable rich-text views, exercise badge, editor, and toolbar.
- `src/editor/session.ts`: schema-independent Yjs document/awareness lifetime.
- `src/editor/storage/`, `schema/`, `rich-text/`: independent backend/schema core.
- `src/demo/`: two replicas per document, one student, mode controls, document inspector.

Content drives traversal in every mode, including exercises with no answer yet.
Exercise facade reads worksheet context and passes matching response handles and mode to renderers; missing responses remain absent until interaction or feedback initialization.
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

Automatic results and manual overrides are stored separately. Regrading and
switching between feedback editing/viewing preserve comments and overrides;
returning to answering or authoring deletes them. Selecting **Automatisch** restores
the automatic assessment. Exercise comments and overall feedback store ProseMirror JSON,
including bold/italic formatting and lists. Viewing mode serializes that formatting
without mounting editable views.

## Lifetime and limits

All three document pairs live for the app session, independently of mode and pane
visibility. Locked bindings forward source subscriptions and refresh their cached
`ReadonlyNodeStore` projections on source revisions, including remote changes.
Read-only projections reject writes even through programmatic schema methods;
previously obtained values remain immutable snapshots. Mode switches preserve
current and earlier source data and identities; downstream resets use the existing
stores, so deletions synchronize through Yjs without replacing sessions.
`clearFollowingDocuments()` runs once per actual mode switch before binding both
peers; `createModeDocuments()` only composes permissions and initializes grading.

Sessions disconnect all three transports and destroy awareness/Yjs documents on
teardown. Yjs stores unmount every cached rich-text view when their document is
destroyed, including feedback comments. Read-only projection caches become
collectible with their mode. No generic backend disposal or unused-fragment
garbage collection is added.

Returning to content editing clears responses rather than migrating them. Direct
programmatic content edits outside demo mode switches do not reset or migrate
responses: unchanged IDs retain associations after sibling edits, removed responses
remain stored but hidden, and semantic changes under an existing ID can make
responses stale. Publication/versioning, stale-response policy, copy/paste ID
normalization, submissions, analytics UI, durable persistence, network providers,
and cross-document atomic transactions are outside this prototype.

Mode restrictions and read-only storage prevent unintended edits, not unauthorized
access. Debug JSON intentionally includes solutions and must not be exposed as a
student-facing authorization boundary. Grading is deterministic and local; no
alternative gap solutions, semantic matching, or scoring model is implemented.

Rich-text tests cover Yjs replacement content with and without mounted views,
remote changes, cursor isolation, and teardown. Schema/storage suites cover the
shared backend APIs.
