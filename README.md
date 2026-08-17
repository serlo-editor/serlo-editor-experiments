# Serlo Editor experiments

Small Vite/React/TypeScript experiments in one pnpm workspace for creating the Serlo Editor.

## Create

```bash
pnpm new <template> <name-of-experiment>
```

Templates currently include `react` and `ts`.

Names must be kebab-case.

## Run

```bash
pnpm --dir experiments/<name> dev
# or
pnpm --filter <name> dev
```

## Build

```bash
pnpm --dir experiments/<name> build
```
