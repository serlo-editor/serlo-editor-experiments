# JSON storage implementation

## Goal

Build an executable prototype for saving and loading editor content represented as restricted JSON structures.

Prototype compares two storage implementations behind one shared API:

- **Map storage** for local, non-collaborative use.
- **Yjs storage** backed by a local `Y.Doc` for future collaborative use.

Both implementations only need to save and load values. They do not need to support concurrent edits. API details will be defined during implementation.

Supported values are composed recursively from:

- booleans
- strings
- arrays
- objects

Numbers and `null` are not supported.

## What to demonstrate

- Saving supported values with either implementation.
- Loading saved values with either implementation.
- Equivalent behavior through the shared API.
- Yjs-backed storage working without a network provider.

## Do not implement

- Concurrent editing.
- Conflict resolution or merge behavior.
- Network synchronization or Yjs providers.
- User presence or awareness.
- Local browser storage such as `localStorage` or IndexedDB.
- Subscriptions, change events, or live updates.
- Authentication, permissions, or persistence beyond the process lifetime.
- Final production API design.
- Unsupported JSON values such as numbers and `null`.
