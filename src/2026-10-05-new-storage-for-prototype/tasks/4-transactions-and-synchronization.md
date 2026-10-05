# 4. Transactions and synchronization

Relevant files: `src/storage/types.ts`, `src/storage/yjs.ts`,
`src/storage/flat.ts`, and prototype's `src/demo/sync-cdrts.ts`.

- [ ] Define local transaction origin compatible with prototype transport, or
      change transport to distinguish local and received transactions explicitly.
      Backend edits with null origin currently get dropped by prototype helper.
- [ ] Preserve grouped/nested editor operations and return values; observers must
      see completed operations rather than partially attached content.
- [ ] Specify error semantics. Existing stores do not provide rollback; do not
      promise it merely because API is called `transact`.
- [ ] Add two-document checks for initialization, cell changes, array insertion/
      removal, and object edits using same forwarding rules as consumer.

**Done when:** edits propagate both directions, grouped updates expose consistent
state, and received updates do not create forwarding loops.
