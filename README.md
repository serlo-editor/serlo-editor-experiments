# Serlo Editor experiments

Small Vite/React/TypeScript experiments in one pnpm workspace for creating the Serlo Editor.

## Learnings

Design notes and learnings from experiments live in [`learnings/`](./learnings/).

## Create

```bash
pnpm new <template> <name-of-experiment>
```

Templates currently include `react` and `ts`.

Names must be kebab-case.

## Run

```bash
pnpm --dir src/<name> dev
```

## Build

```bash
pnpm --dir src/<name> build
```

## GitHub Pages

React experiments deploy on every push to `main`:

```text
https://serlo-editor.github.io/serlo-editor-experiments/
```

Site index links every React experiment. Enable **Settings → Pages → Source: GitHub Actions** once.
