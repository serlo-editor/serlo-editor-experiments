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
