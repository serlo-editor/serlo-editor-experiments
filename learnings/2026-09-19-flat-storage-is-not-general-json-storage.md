# Flat Storage Is Not General JSON Storage

## Context

`src/2026-09-19-flatstorage-test/` explores a flat storage abstraction that could serve both Yjs and ordinary flat storage.

## Learning

Yjs operates one level above flat storage. Its API stores and retrieves JSON structures rather than individual flat values. Therefore, this abstraction is a useful foundation for a flat JSON store or class used underneath one, but not a good basis for the overall JSON storage API.

The storage layer should expose JSON-level operations, with flat node storage kept as an implementation detail.
