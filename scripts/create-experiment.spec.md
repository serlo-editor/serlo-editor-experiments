# `scripts/create-experiment.ts` pseudo-code

Short algorithm review version.

```ts
main(nameArg)
  name = validate(nameArg)
  ensure experiments/ exists
  finalDir = experiments/name
  fail if finalDir exists

  tempDir = mkdtemp(os.tmpdir())

  try:
    run pnpm create vite tempDir --template react-ts
    remove tempDir/.gitignore
    move tempDir -> experiments/name
    delete tempDir
  catch error:
    delete tempDir and any partial finalDir
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
- Remove the generated local `.gitignore`
- Keep a local `pnpm-lock.yaml` inside each experiment
- Use `pnpm` elsewhere (no support for 'pnpm.cmd' on Windows needed)
