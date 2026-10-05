# 9. Verify replacement end to end

Stage 2: Integrate prototype. [Task index](../TASKS.md).
Scope includes this experiment and `2026-10-05-current-prototype`.
Start after backend contracts and compatibility checks are ready.

- [ ] Run shared contract/schema tests against both stores; add regression checks
      alongside new non-trivial behavior.
- [ ] Add consumer compatibility test using full initial content and existing
      document reopening.
- [ ] Add browser-level checks for initial rendering, checkbox sync both ways,
      typing in normal text and multiple-choice question, bold/italic/gap
      formatting, toolbar focus, cursor filtering, and debug JSON updates.
- [ ] Check remote structural edits trigger React rerender without legacy counter.
- [ ] Check concurrent edits converge and reopening does not reset fragments or
      duplicate structural content.
- [ ] Run `pnpm fix` from this experiment root and `bun run fix` from repository
      root. After prototype code changes, follow prototype's `AGENTS.md`; if its
      referenced e2e command is absent, provide runnable browser check rather than
      claiming it passed.
- [ ] Update experiment README to describe implemented API, import example, and
      remaining limitations. Only mark tasks complete after acceptance checks pass.

**Replacement ready when:** prototype preserves external JSON and collaborative
behavior while using new backend for structural content. No durable persistence
or migration of old internal Yjs layout required for this milestone.
