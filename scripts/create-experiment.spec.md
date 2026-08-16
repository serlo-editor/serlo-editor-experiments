# `scripts/create-experiment.ts` pseudo-code

Short algorithm review version.

```ts
main(nameArg)
  name = validate(nameArg)
  ensure experiments/ exists
  finalDir = experiments/name
  fail if finalDir exists

  tempRoot = mkdtemp(os.tmpdir())
  tempDir = tempRoot/name

  try:
    run pnpm create vite tempDir --template react-ts
    patch package.json name = experiment name
    replace starter app with minimal app
    delete unneeded Vite files (.gitignore, assets, App.css, vite.svg, etc.)
    run pnpm install in tempDir
    move tempDir -> experiments/name
    delete tempRoot
    print next steps
  catch error:
    delete tempRoot and any partial finalDir
    print readable error + stderr if available
    exit non-zero
```

## Validation

```ts
validate(name)
  require name
  require /^[a-z0-9]+(?:-[a-z0-9]+)*$/
```

Reject spaces, uppercase, underscores, traversal, and special chars.

## Key rules

- Use `pnpm create vite ... --template react-ts`
- Use a temp directory first
- Install inside the temp scaffold
- Only move into `experiments/<name>` after success
- Keep the generated app frontend-only and minimal
- Remove the generated local `.gitignore`
- Keep a local `pnpm-lock.yaml` inside each experiment
- Use `pnpm.cmd` on Windows, `pnpm` elsewhere
```
