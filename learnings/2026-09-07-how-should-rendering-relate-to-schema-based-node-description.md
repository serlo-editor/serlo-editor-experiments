# AST Node Description Rendering Question

## Context

I need to describe AST nodes with schema objects, for example:

```ts
const Tags = Schema.array(Schema.string())
```

## Decision Question

How should rendering relate to schema-based node description?

1. Attach `render()` as arg/property on schema.
2. Use separate unit that combines `stateSchema` + `render`.
3. Put state inside `render()` via hook-like API.

## Answer

Use separate unit that combines `stateSchema` with `render`.

`stateSchema` defines persisted AST state and invariants. Keep it independent from React, editor APIs, and storage.

This keeps core model reusable for load/save, validation, migrations, transformations, collaboration, and future preview/export targets. Storage and rendering stay separate concerns, both driven by same unit state.

### Advantages

- Reuse state schemas in planned migration and transformation library.
- Keep document model independent from React and editor runtime.
- Support multiple render targets: editor, preview, export.
- Replace storage or rendering implementations without changing AST model.
- Make semantic units explicit instead of generic nodes.
- Isolate UI complexity from core domain model.

### Disadvantages

- More concepts and wiring than attaching renderer directly to schema.
- Need registry or adapter mapping from unit type to renderer.
- Type drift possible if schema and renderer are not kept aligned.
- Small prototype may feel heavier until second adapter exists.

## Follow-up

Editor is an AST of educational units. An educational unit is plugin-like: it represents one meaningful learning-content element, defined by a specific composition of state.

Examples: multiple-choice exercise, rich-text element, question set.

Editor adapter maps each unit type to React editing behavior. So the same apater pattern is used for the editor and rendering as for the adapter and loading / saving.
