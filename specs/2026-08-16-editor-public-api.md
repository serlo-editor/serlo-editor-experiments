# Serlo Editor React API Specification

## 1. Scope

The API is a **React-only integration API** for embedding the Serlo Editor into an LMS. It is not intended to expose a general-purpose editor framework.

The API supports:

- creating an editor instance through a React hook,
- rendering it through a React component,
- loading and retrieving a JSON document,
- observing document, interaction, lifecycle, collaboration, and error events,
- running the editor in educational workflow modes,
- configuring allowed document types,
- loading external documents and replacing documents through distinct operations,
- integrating collaborative editing through a reserved adapter boundary,
- exposing editor commands and reactive editor state.

The API is an exploratory rewrite and does not preserve compatibility with the current `@serlo/editor` package.

---

# 2. Basic usage

```tsx
import { SerloEditor, useSerloEditor } from "@serlo/editor"

function ExerciseEditor() {
  const editor = useSerloEditor({
    mode: "authoring",
    language: "en",

    initialDocument: null,

    types: [articleDocumentType, exerciseDocumentType],

    onDocumentChange(event) {
      console.log(event.document)
    },

    onError(event) {
      console.error(event.error)
    },
  })

  return <SerloEditor editor={editor} className="editor" aria-label="Exercise editor" />
}
```

`useSerloEditor()` owns the lifecycle of the editor instance. The returned instance remains referentially stable for the lifetime of the hook.

`<SerloEditor>` is responsible only for rendering the UI. Behavioral configuration and callbacks belong to `useSerloEditor()`.

---

# 3. Public modes

```ts
export type EditorMode = "authoring" | "learning" | "feedback-authoring" | "feedback-viewing"
```

The mode is immutable for the lifetime of an editor instance. Changing the mode requires remounting the hook, normally by changing a React `key`.

Each mode defines which document regions may be changed by local UI and API operations. These permissions are part of the domain definition, not merely UI conventions:

```ts
const modePermissions = {
  authoring: {
    writableRegions: ["document-type", "content"],
  },

  learning: {
    writableRegions: ["response"],
  },

  "feedback-authoring": {
    writableRegions: ["feedback"],
  },

  "feedback-viewing": {
    writableRegions: [],
  },
}
```

For example, learning mode may persist learner results in `response`, but it must not change authored `content`. Feedback authoring may change only `feedback`. This restriction applies consistently to UI edits, imperative commands, replacement edits, undo, and redo. An operation that would modify a non-writable region fails with `"operation-not-allowed"` and leaves the document unchanged.

Remote collaboration updates may still update any region because they represent authoritative external state rather than a local edit. The detailed interaction between domain permissions and collaboration remains to be specified with the collaboration adapter.

---

# 4. Hook API

```ts
export function useSerloEditor(options: UseSerloEditorOptions): SerloEditorInstance
```

## 4.1 Options

```ts
export interface UseSerloEditorOptions {
  /**
   * Initial serialized document.
   *
   * Omission and `null` both represent that no document type
   * has yet been selected.
   */
  readonly initialDocument?: SerloDocument | null

  /**
   * Immutable educational workflow mode.
   */
  readonly mode: EditorMode

  /**
   * BCP 47 language tag used by the editor UI, for example `"en"`
   * or `"de"`. Omission uses the editor's built-in default language.
   */
  readonly language?: string

  /**
   * Allowed document types.
   *
   * Omission uses all built-in document types.
   * An explicitly empty array is invalid.
   */
  readonly types?: NonEmptyReadonlyArray<SerloDocumentType>

  /**
   * Type automatically selected when no document exists.
   *
   * Without this option, the built-in type selector is shown
   * when multiple types are allowed.
   */
  readonly defaultType?: DocumentTypeId

  /**
   * Optional identities used by collaboration, telemetry,
   * feedback attribution, or LMS integrations.
   */
  readonly identity?: EditorIdentity

  /**
   * Reserved collaboration integration boundary.
   *
   * Its detailed contract is intentionally deferred.
   */
  readonly collaboration?: CollaborationConfig

  /**
   * Receives every public editor event.
   */
  readonly onEvent?: EditorEventListener

  /**
   * Receives committed document changes.
   */
  readonly onDocumentChange?: (event: DocumentChangeEvent) => void

  /**
   * Receives non-document user interactions.
   */
  readonly onInteraction?: (event: InteractionEvent) => void

  /**
   * Receives collaboration events.
   */
  readonly onCollaborationEvent?: (event: CollaborationEvent) => void

  /**
   * Receives editor errors.
   */
  readonly onError?: (event: EditorErrorEvent) => void
}
```

## 4.2 Non-empty type arrays

An explicitly empty `types` array should be rejected by TypeScript where possible.

```ts
export type NonEmptyReadonlyArray<T> = readonly [T, ...T[]]
```

Example:

```ts
useSerloEditor({
  mode: "authoring",
  types: [], // TypeScript error
})
```

Runtime validation must still reject invalid JavaScript input.

---

# 5. Rendering component

```ts
export interface SerloEditorProps
  extends Omit<React.ComponentPropsWithoutRef<"div">, "children"> {
  readonly editor: SerloEditorInstance
}

export function SerloEditor(props: SerloEditorProps): React.ReactElement
```

The component supports common HTML container attributes, including `id`, `className`, `style`, `data-*`, and `aria-*`, and forwards them to its root container. It does not accept children or behavioral editor callbacks. Event callbacks belong exclusively to `useSerloEditor()`.

On the server, the component renders an empty hydration container carrying the supported HTML attributes.

Custom type-selection and fatal-error interfaces are a future feature. The initial API uses built-in interfaces; a later API should provide render hooks or slots so hosts can integrate localization, branding, retry actions, and design-system components without replacing the editor.

---

# 6. Editor instance

```ts
export interface SerloEditorInstance {
  /**
   * Returns the current canonical JSON document.
   *
   * Returns null when no document type has been selected.
   */
  getDocument(): DeepReadonly<SerloDocument> | null

  /**
   * Loads an external document as editor state.
   *
   * Loading resets selection and undo/redo history and is not an edit.
   */
  loadDocument(document: SerloDocument | null): EditorResult<void>

  /**
   * Replaces the complete document as one undoable API edit.
   *
   * The replacement must respect the writable regions of the current mode.
   */
  replaceDocument(document: SerloDocument): EditorResult<void>

  /**
   * Selects and initializes an allowed document type.
   */
  selectDocumentType(typeId: DocumentTypeId): EditorResult<void>

  /**
   * Focuses the editor.
   *
   * Fails when the editor is not ready or has no mounted renderer.
   */
  focus(): EditorResult<void>

  /**
   * Undoes the latest undoable change.
   *
   * Fails when the editor is not ready or undo is unavailable.
   */
  undo(): EditorResult<void>

  /**
   * Redoes the latest undone change.
   *
   * Fails when the editor is not ready or redo is unavailable.
   */
  redo(): EditorResult<void>

  /**
   * Subscribes to every public event.
   */
  subscribe(listener: EditorEventListener): Unsubscribe

  /**
   * Subscribes to committed document changes.
   */
  onDocumentChange(listener: (event: DocumentChangeEvent) => void): Unsubscribe

  /**
   * Subscribes to non-document interactions.
   */
  onInteraction(listener: (event: InteractionEvent) => void): Unsubscribe

  /**
   * Subscribes to collaboration events.
   */
  onCollaborationEvent(listener: (event: CollaborationEvent) => void): Unsubscribe

  /**
   * Subscribes to errors.
   */
  onError(listener: (event: EditorErrorEvent) => void): Unsubscribe
}
```

```ts
export type Unsubscribe = () => void
```

The editor instance is disposed automatically when the component using `useSerloEditor()` unmounts. No public `destroy()` method is required.

---

# 7. Document access

## 7.1 Canonical JSON

The value returned by `getDocument()` has the same public JSON shape accepted through `initialDocument`.

The following round trip must preserve the canonical document:

```ts
const document = editor.getDocument()

const secondEditor = useSerloEditor({
  mode: "authoring",
  initialDocument: document,
})
```

The document is deeply immutable in the TypeScript API. Implementations may use structural sharing and must not guarantee reference identity between calls.

**Open API issue:** `DeepReadonly` provides only compile-time immutability. The specification does not yet guarantee whether returned values are frozen, copied, or otherwise isolated from internal editor state at runtime. This must be resolved before the API is considered stable; no particular solution is proposed yet.

```ts
export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? {
          readonly [Key in keyof T]: DeepReadonly<T[Key]>
        }
      : T
```

## 7.2 Null document

`null` represents that no document type has been selected.

```ts
editor.getDocument() === null
```

If exactly one document type is allowed, the editor creates an empty document of that type automatically.

If several types are allowed and no `defaultType` is configured, the built-in type-selection interface is shown.

---

# 8. Document format

The exact document schema remains to be designed. The top-level envelope should contain at least:

```ts
export interface SerloDocument {
  readonly schema: "serlo-document"
  readonly version: number
  readonly type: DocumentTypeId
  readonly content: unknown

  /**
   * Mode-specific persisted state.
   *
   * Exact structure remains to be specified.
   */
  readonly response?: unknown
  readonly feedback?: unknown
}
```

Example:

```json
{
  "schema": "serlo-document",
  "version": 1,
  "type": "multiple-choice-exercise",
  "content": {
    "question": "Which numbers are prime?",
    "answers": [
      {
        "id": "answer-1",
        "text": "2"
      },
      {
        "id": "answer-2",
        "text": "4"
      }
    ]
  },
  "response": {
    "selectedAnswerIds": ["answer-1"]
  },
  "feedback": []
}
```

The document is one aggregate JSON value containing content, final learner responses, and feedback. Interaction history is not stored in the document.

---

# 9. Document types

The detailed `SerloDocumentType` contract is deliberately deferred.

The current API assumes consumers can pass supported document-type definitions:

```ts
export interface SerloDocumentType {
  readonly id: DocumentTypeId

  /**
   * Further fields remain unspecified.
   */
}
```

```ts
export type DocumentTypeId = string
```

Built-in types are exported individually and as a default collection:

```ts
import { articleDocumentType, exerciseDocumentType, defaultDocumentTypes } from "@serlo/editor"
```

```ts
useSerloEditor({
  mode: "authoring",
  types: defaultDocumentTypes,
})
```

Omitting `types` is equivalent to using `defaultDocumentTypes`.

Experimental custom document-type creation may later be exposed through an experimental namespace:

```ts
import { experimental } from "@serlo/editor"

const customType = experimental.createDocumentType({
  // Contract remains undefined.
})
```

---

# 10. Default type selection

```ts
useSerloEditor({
  mode: "authoring",
  initialDocument: null,
  types: [articleDocumentType, exerciseDocumentType],
  defaultType: "exercise",
})
```

Rules:

1. A non-null document determines its type through its own `type` field.
2. `defaultType` is ignored when a non-null document exists.
3. `defaultType` must reference one of the effective allowed types.
4. An invalid `defaultType` produces a fatal configuration error.
5. Selecting a type creates a canonical empty document for that type.

---

# 11. Loading and replacing documents

Loading external state and performing an editor mutation are separate operations. Combining them behind a strategy flag would make autosave and telemetry treat externally loaded state as a user edit and would obscure their different history semantics.

## 11.1 Loading external state

```ts
editor.loadDocument(nextDocument)
```

`loadDocument()`:

- replaces the entire document,
- resets selection,
- resets undo and redo history,
- validates, migrates, and normalizes the new document,
- accepts `null`,
- emits applicable migration and normalization lifecycle events followed by `"document-loaded"`,
- does not emit `"document-change"`.

Loading is not subject to mode write permissions because it establishes authoritative external state rather than performing a domain edit.

## 11.2 Replacement edit

```ts
editor.replaceDocument(nextDocument)
```

`replaceDocument()`:

- treats replacement as one undoable API edit,
- does not accept `null`,
- validates the new document,
- rejects changes to regions that are not writable in the current mode,
- emits a document-change event with subtype `"document-replaced"` and origin `"api"`.

## 11.3 Failure

```ts
const result = editor.replaceDocument(document)

if (!result.ok) {
  console.error(result.error)
}
```

Invalid or disallowed input does not modify the current document. The method returns a failed `EditorResult` but does not also emit an error event. A failure returned directly to the caller is expected operation feedback; emitting it globally would cause hosts that handle both channels to report the same failure twice. Error events are reserved for unsolicited failures that cannot be returned directly to the initiating caller.

---

# 12. Result model

Operations with meaningful runtime failures return `EditorResult`.

```ts
export type EditorResult<Value, Failure extends EditorError = EditorError> = Value extends void
  ? | { readonly ok: true }
    | {
        readonly ok: false
        readonly error: Failure
      }
  : | {
        readonly ok: true
        readonly value: Value
      }
    | {
        readonly ok: false
        readonly error: Failure
      }
```

Example:

```ts
const result = editor.selectDocumentType("exercise")

if (!result.ok) {
  handleError(result.error)
}
```

Programming errors and violated internal invariants may still throw. Runtime failures caused by external input or adapters should use `EditorResult`. A failure returned from a directly invoked operation is not additionally emitted as an error event.

Asynchronous adapter operations may use:

```ts
Promise<EditorResult<T>>
```

Local synchronous operations should remain synchronous.

---

# 13. Error model

```ts
export class EditorError extends Error {
  readonly code: EditorErrorCode
  readonly fatal: boolean

  constructor(options: { code: EditorErrorCode; message: string; fatal: boolean; cause?: unknown })
}
```

```ts
export type EditorErrorCode =
  | "invalid-document"
  | "unsupported-document-version"
  | "unsupported-document-type"
  | "invalid-default-type"
  | "invalid-configuration"
  | "editor-not-ready"
  | "operation-not-allowed"
  | "collaboration-failed"
  | "adapter-failed"
  | "event-listener-failed"
```

Fatal initialization errors do not cause `useSerloEditor()` to throw. The editor instance remains available, enters the `"error"` state, and `<SerloEditor>` renders a built-in error interface.

---

# 14. Event system

## 14.1 Event union

```ts
export type EditorEvent =
  DocumentChangeEvent | InteractionEvent | CollaborationEvent | LifecycleEvent | EditorErrorEvent
```

Every event belongs to one stable top-level category.

## 14.2 Shared event fields

Transaction identifiers are used only for document and interaction events.

```ts
export interface EventBase {
  readonly editor: SerloEditorInstance
  readonly timestamp: number
}
```

`timestamp` contains Unix milliseconds.

```ts
Date.now()
```

## 14.3 Document change events

```ts
export interface DocumentChangeEvent extends EventBase {
  readonly type: "document-change"

  readonly transactionId: string

  /**
   * Version and canonical document captured for this committed transaction.
   * They remain the event-time state even if later transactions occur.
   */
  readonly documentVersion: number
  readonly document: DeepReadonly<SerloDocument> | null

  readonly changed: readonly DocumentRegion[]

  readonly subtype?: "type-selected" | "document-replaced"

  readonly origin: DocumentChangeOrigin
}
```

```ts
export type DocumentRegion = "content" | "response" | "feedback" | "document-type"
```

```ts
export type DocumentChangeOrigin = "user" | "api" | "remote" | "undo" | "redo" | "system"
```

A document-change event contains the canonical document and version produced by its transaction:

```ts
function onDocumentChange(event: DocumentChangeEvent) {
  save(event.document)
}
```

Consumers should use `event.document` for persistence and asynchronous processing. Calling `event.editor.getDocument()` later may return a newer transaction, which would make the event unsuitable as a stable audit or persistence record.

One public document-change event is emitted per committed editor transaction.

## 14.4 Type selection

Selecting a document type through the built-in UI emits:

```ts
{
  type: "document-change",
  subtype: "type-selected",
  changed: ["document-type", "content"],
  origin: "user",
  documentVersion: 1,
  document: selectedDocument,
  transactionId: "...",
  editor,
  timestamp,
}
```

Type selection is therefore not a separate top-level event category. Calling `editor.selectDocumentType()` programmatically emits the same event with origin `"api"`; origin identifies the initiator rather than the kind of mutation.

## 14.5 Learning-mode changes

A learner action that changes the persisted final response is a specialized document change.

```ts
{
  type: "document-change",
  changed: ["response"],
  origin: "user",
  documentVersion: 12,
  document: learnerDocument,
  transactionId: "...",
  editor,
  timestamp,
}
```

It may also carry optional interaction metadata in a future refinement. [Confidence: Medium]

## 14.6 Interaction events

Interactions that do not modify the document use a separate event category.

```ts
export interface InteractionEvent extends EventBase {
  readonly type: "interaction"

  readonly transactionId: string

  readonly subtype: string

  readonly nodeId: string

  readonly path: NodePath

  readonly data?: unknown
}
```

```ts
export type NodePath = readonly (string | number)[]
```

Examples include:

- opening a hint,
- checking an answer without storing a new response,
- focusing a relevant exercise field,
- opening an authoring interface.

Interaction subtypes remain open strings because plugins may define domain-specific interactions.

```ts
{
  type: "interaction",
  subtype: "hint-opened",
  nodeId: "exercise-42",
  path: ["content", 3],
  data: {
    hintId: "hint-1",
  },
  transactionId: "transaction-17",
  editor,
  timestamp,
}
```

## 14.7 Event correlation

Events caused by the same editor transaction share a `transactionId`.

```ts
documentChange.transactionId === interaction.transactionId
```

This allows an xAPI adapter to correlate a learner interaction with the resulting document mutation.

## 14.8 xAPI

The editor does not produce complete xAPI statements directly. It emits domain events that an external adapter converts into xAPI statements.

```ts
useSerloEditor({
  mode: "learning",

  onEvent(event) {
    xapiAdapter.handle(event)
  },
})
```

The xAPI adapter may add:

- actor,
- activity ID,
- registration,
- authority,
- LMS context,
- endpoint-specific metadata.

---

# 15. Event listener failures

If one event listener throws:

1. delivery continues to other listeners,
2. the editor emits an `event-listener-failed` error event,
3. that error event is not delivered back to the listener that failed,
4. failures thrown while delivering an `event-listener-failed` event do not produce another `event-listener-failed` event.

The final guard is necessary because excluding only the original listener is insufficient: another failing error listener could otherwise start recursive failure events. Listener failures during guarded error delivery may be reported through development diagnostics, but they do not re-enter the public event stream. [Confidence: High]

---

# 16. Lifecycle events

```ts
export interface LifecycleEvent extends EventBase {
  readonly type: "lifecycle"

  readonly subtype:
    | "initializing"
    | "document-migrated"
    | "document-normalized"
    | "document-loaded"
    | "ready"
    | "destroyed"

  readonly data?: unknown
}
```

Initialization follows this deterministic order:

```text
initializing
document-migrated?
document-normalized?
document-loaded
ready
```

Only events corresponding to operations that actually occurred are emitted.

## 16.1 Migration event

```ts
interface DocumentMigratedEvent extends LifecycleEvent {
  readonly subtype: "document-migrated"

  readonly data: {
    readonly fromVersion: number
    readonly toVersion: number
  }
}
```

Migration does not emit `document-change`, because migration is part of loading rather than user editing.

An LMS can persist the migrated document in response:

```ts
function onEvent(event: EditorEvent) {
  if (event.type === "lifecycle" && event.subtype === "document-migrated") {
    save(event.editor.getDocument())
  }
}
```

## 16.2 Normalization event

Validation may:

- add default fields,
- canonicalize values.

Unknown fields must not be silently stripped. If the current internal state representation can preserve them safely, the editor should retain and round-trip them and show a non-fatal warning that parts of the document are not understood by this editor version. If preservation is not possible, loading must fail rather than accept the document and lose data.

When normalization changes the supplied value, the editor emits:

```ts
{
  type: "lifecycle",
  subtype: "document-normalized",
  editor,
  timestamp,
}
```

The LMS may then persist the canonical value.

---

# 17. Validation and migration

External JSON is validated:

- during initialization,
- during `loadDocument()`,
- during `replaceDocument()`.

Valid input may be normalized into a canonical document. Normalization must not silently discard unknown fields.

Forward-compatible preservation of unknown fields—and, where the editor state can represent them, newer document types—is a future feature. Until that feature is implemented, unsupported input that cannot be preserved must be rejected with a visible non-fatal warning or an appropriate failed `EditorResult`, rather than being loaded destructively.

Older supported versions are migrated automatically.

```ts
const editor = useSerloEditor({
  mode: "authoring",
  initialDocument: oldDocument,
})
```

After initialization:

```ts
editor.getDocument()
```

returns the migrated canonical document.

The top-level document has one public format version. Plugins may internally provide more granular migrations, but those versions are not necessarily part of the public document contract.

---

# 18. Reactive React state

```ts
export function useSerloEditorState<Selected>(
  editor: SerloEditorInstance,
  selector: (snapshot: SerloEditorSnapshot) => Selected,
  equality?: (previous: Selected, next: Selected) => boolean,
): Selected
```

Strict equality is used by default. Consumers may provide a custom equality function.

```ts
export interface SerloEditorSnapshot {
  readonly editorStatus: EditorStatus

  readonly collaborationStatus: CollaborationStatus

  readonly canUndo: boolean
  readonly canRedo: boolean

  /**
   * Increments whenever the canonical document changes.
   */
  readonly documentVersion: number
}
```

The complete document is deliberately excluded from the public snapshot for now.

Example:

```tsx
function UndoButton({ editor }: { editor: SerloEditorInstance }) {
  const canUndo = useSerloEditorState(editor, (snapshot) => snapshot.canUndo)

  return (
    <button
      disabled={!canUndo}
      onClick={() => {
        const result = editor.undo()

        if (!result.ok) handleCommandFailure(result.error)
      }}
    >
      Undo
    </button>
  )
}
```

A dedicated reactive document hook is reserved for later.

```ts
// Not part of the initial API:
useSerloDocument(editor)
```

---

# 19. Editor status

```ts
export type EditorStatus = "initializing" | "ready" | "error"
```

```ts
export type CollaborationStatus = "disabled" | "connecting" | "connected" | "disconnected" | "error"
```

Editor readiness and collaboration connectivity are separate because the editor may remain usable while collaboration is disconnected.

During initialization, only the following operations are valid:

- `getDocument()`,
- subscriptions,
- snapshot inspection.

Commands do not execute before readiness. They return a failed `EditorResult` containing an `"editor-not-ready"` error. Expected command failures are returned only to the caller and do not additionally emit error events.

---

# 20. Collaborative initialization

When both `initialDocument` and collaboration are configured:

- the initial document seeds the collaborative state only when the remote document is empty,
- existing remote state is authoritative,
- destructive remote replacement is not part of the initial API.

When `initialDocument` is `null`, document-type selection initializes the shared document for all participants.

Whether disconnected editing is permitted is determined by the collaboration integration.

The detailed collaboration adapter contract remains deferred.

```ts
export interface CollaborationConfig {
  /**
   * Intentionally unspecified.
   */
}
```

---

# 21. Identity

```ts
export interface EditorIdentity {
  readonly documentId?: string
  readonly userId?: string
  readonly sessionId?: string
}
```

Identity fields are optional at the core API level. Individual integrations may require them.

Examples:

- collaboration may require `documentId`,
- feedback attribution may require `userId`,
- xAPI may require `userId` and `sessionId`.

Missing identity required by configured functionality produces a fatal configuration error rather than generating an implicit ID.

---

# 22. Immutable options

The following options are initialization-only:

- `mode`,
- `language`,
- `types`,
- `defaultType`,
- `identity`,
- `collaboration`,
- `initialDocument`.

Changing them after initialization does not recreate or mutate the editor automatically.

In development, the hook should emit a warning:

```text
The "mode" option changed after the Serlo Editor was created.
Remount useSerloEditor() with a different React key to apply the change.
```

Callbacks always use the latest React values and do not require `useCallback`.

```tsx
const editor = useSerloEditor({
  mode,
  onDocumentChange(event) {
    // Uses the latest component closure.
  },
})
```

---

# 23. External Save button

```tsx
function Page() {
  const editor = useSerloEditor({
    mode: "authoring",
    initialDocument,
  })

  function save() {
    const document = editor.getDocument()

    if (document === null) {
      return
    }

    api.saveDocument(document)
  }

  return (
    <>
      <SerloEditor editor={editor} />

      <button onClick={save}>Save</button>
    </>
  )
}
```

The host does not need to mirror the entire JSON document in React state merely to implement saving.

---

# 24. Autosave

```tsx
const editor = useSerloEditor({
  mode: "authoring",

  onDocumentChange(event) {
    autosave.schedule(event.document)
  },
})
```

Debouncing is the responsibility of the LMS or persistence layer. The editor emits once per committed transaction and does not debounce its event stream.

---

# 25. Learning mode with xAPI

```tsx
const editor = useSerloEditor({
  mode: "learning",

  initialDocument: learnerDocument,

  identity: {
    documentId: activityId,
    userId,
    sessionId,
  },

  onDocumentChange(event) {
    saveLearnerResponse(event.document)
  },

  onInteraction(event) {
    xapiAdapter.handle(event)
  },

  onEvent(event) {
    telemetry.record(event)
  },
})
```

Only final learner answers are stored in the document. The historical interaction stream is emitted separately.

---

# 26. Feedback authoring

```tsx
const editor = useSerloEditor({
  mode: "feedback-authoring",

  initialDocument: submissionDocument,

  identity: {
    documentId,
    userId: teacherId,
  },

  onDocumentChange(event) {
    if (event.changed.includes("feedback")) {
      saveFeedback(event.document)
    }
  },
})
```

The long-term feedback target should support:

```ts
export type FeedbackTarget =
  | {
      readonly type: "document"
    }
  | {
      readonly type: "node"
      readonly nodeId: string
      readonly path?: NodePath
    }
  | {
      readonly type: "range"
      readonly nodeId: string
      readonly range: unknown
    }
```

The initial implementation may support only a subset without changing the union shape.

---

# 27. Complete proposed surface

```ts
export {
  SerloEditor,
  useSerloEditor,
  useSerloEditorState,
  defaultDocumentTypes,
  articleDocumentType,
  exerciseDocumentType,
}

export type {
  UseSerloEditorOptions,
  SerloEditorProps,
  SerloEditorInstance,
  SerloEditorSnapshot,
  EditorMode,
  EditorStatus,
  CollaborationStatus,
  EditorIdentity,
  SerloDocument,
  SerloDocumentType,
  DocumentTypeId,
  EditorResult,
  EditorErrorCode,
  EditorEvent,
  DocumentChangeEvent,
  InteractionEvent,
  CollaborationEvent,
  LifecycleEvent,
  EditorErrorEvent,
  DocumentRegion,
  DocumentChangeOrigin,
  FeedbackTarget,
  NodePath,
  Unsubscribe,
}
```

---

# 28. Deferred decisions

The following areas remain intentionally unspecified:

1. Exact `SerloDocument` schema.
2. Exact `SerloDocumentType` contract.
3. Plugin definition and plugin extension API.
4. Collaboration adapter interface.
5. Detailed collaboration behavior when remote updates affect regions that are locally read-only in the current mode.
6. Feedback range representation.
7. Exact interaction subtype payloads.
8. Dedicated reactive document hook.
9. Custom type-selection UI (future render-hook or slot feature).
10. Custom error UI (future render-hook or slot feature).
11. Forward-compatible preservation of unknown fields and newer document types when the internal state representation permits it.
12. Runtime isolation guarantees for documents returned by `getDocument()` and carried by events.

These boundaries are reserved without prematurely committing the exploratory API to implementation details.
