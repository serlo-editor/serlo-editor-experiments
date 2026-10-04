# Serlo Editor experiments

Small Vite/React/TypeScript experiments in one Bun workspace for creating the Serlo Editor.

## Learnings

Design notes and learnings from experiments live in [`learnings/`](./learnings/).

## Create

```bash
bun run new <template> <name-of-experiment>
```

Templates currently include `react` and `ts`.

Names must be kebab-case.

## Check and fix

```bash
bun run check
bun run fix
bun run test
```

`fix` applies lint and formatting fixes, then runs checks.

## Run

```bash
bun --cwd src/<name> run dev
```

## Build

```bash
bun --cwd src/<name> run build
```

## GitHub Pages

React experiments deploy on every push to `main`:

```text
https://serlo-editor.github.io/serlo-editor-experiments/
```

Site index links every React experiment. Enable **Settings → Pages → Source: GitHub Actions** once.
