# Specification: Serlo Editor Experiments Monorepo

## 1. Objective

Create a single Git repository for rapidly building independent React experiments.

Each experiment must:

- Be a standalone website.
- Have its own dependencies.
- Have its own lockfile.
- Be independently installable, runnable, and buildable.
- Be created through one command.
- Avoid requiring a new Git repository.

The implementation should use:

- React
- TypeScript
- Vite
- pnpm
- pnpm workspaces
- Node.js scripts written in TypeScript

Do not introduce Turborepo, Nx, Lerna, or another monorepo framework unless explicitly requested later.

## 2. Repository Scope

This specification applies to the current repository root.

The root package name must be:

```json
"serlo-editor-experiments"
```

## 3. Repository Structure

Create a minimal root structure similar to:

```text
.
├── experiments/
│   └── .gitkeep
├── scripts/
│   └── create-experiment.ts
├── .gitignore
├── .npmrc
├── package.json
├── pnpm-workspace.yaml
├── README.md
├── spec.md
└── tsconfig.json
```

Do not create a `templates/` directory.

Generated experiments should keep the structure produced by Vite, with only the required post-processing defined in this spec.

## 4. Workspace Configuration

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "experiments/*"

sharedWorkspaceLockfile: false
```

Each experiment must generate and retain its own `pnpm-lock.yaml`.

A root `pnpm-lock.yaml` is allowed if needed, but it must not be relied on for experiment dependency resolution.

## 5. Root Package Configuration

Create a root `package.json` with:

```json
{
  "name": "serlo-editor-experiments",
  "private": true,
  "packageManager": "pnpm@11.22.0",
  "engines": {
    "node": "24.16.0"
  },
  "scripts": {
    "experiment:new": "node --experimental-strip-types scripts/create-experiment.ts"
  },
  "devDependencies": {
    "typescript": "<exact-version>"
  }
}
```

`typescript` should be pinned to an exact version.

Do not add `experiment:list`.

Do not add other root scripts unless required for the implementation.

## 6. Root TypeScript Configuration

Create a root `tsconfig.json` for type-checking the root automation scripts.

Keep it minimal and scoped to the repository scripts.

## 7. Root `.npmrc`

Create `.npmrc`:

```ini
save-exact=true
shared-workspace-lockfile=false
```

This should ensure future manual dependency additions are saved with exact versions and that experiments keep local lockfiles.

## 8. Root `.gitignore`

Create a minimal root `.gitignore` that ignores at least:

```gitignore
node_modules
dist
.DS_Store
*.log
```

It may include other common generated directories if needed, but it should remain minimal.

Do not rely on experiment-local `.gitignore` files.

## 9. Experiment Creation Model

Implement:

```bash
pnpm experiment:new <experiment-name>
```

Example:

```bash
pnpm experiment:new chat-streaming
```

The command must:

1. Validate that an experiment name was provided.
2. Require kebab-case naming.
3. Reject names containing spaces, uppercase letters, underscores, path traversal, or special characters.
4. Reject an experiment if its destination directory already exists.
5. Create `experiments/` automatically if it does not exist.
6. Create the new experiment by running Vite non-interactively through pnpm.
7. Scaffold into a temporary directory first.
8. Post-process the scaffold in the temporary directory.
9. Run `pnpm install` inside the generated experiment.
10. Generate `experiments/<experiment-name>/pnpm-lock.yaml`.
11. Move the completed experiment into `experiments/<experiment-name>` only after success.
12. Print clear next steps.
13. Exit with a non-zero status code when creation fails.
14. Remove incomplete generated directories when creation fails.

## 10. Vite Scaffolding Requirement

The script must use Vite for scaffolding rather than a local template directory.

Use:

```bash
pnpm create vite <temp-directory> --template react-ts
```

This must run fully non-interactively.

Vite is intentionally left unpinned. Future experiments may therefore be scaffolded from newer Vite versions over time.

## 11. Experiment Naming Rules

Use a validation expression equivalent to:

```js
/^[a-z0-9]+(?:-[a-z0-9]+)*$/
```

Valid names:

```text
chat-streaming
structured-output
voice-assistant
image-prompt-lab
```

Invalid names:

```text
ChatStreaming
chat_streaming
chat streaming
../chat
chat@streaming
```

The generated package name must be exactly the experiment name.

This must allow:

```bash
pnpm --filter <experiment-name> dev
```

## 12. Script Implementation

Implement `scripts/create-experiment.ts` using Node.js standard library modules only.

Preferred modules:

```ts
node:fs/promises
node:path
node:child_process
node:process
node:os
```

Do not add a third-party dependency solely for copying directories, replacing placeholders, temp directory management, or process spawning.

The script must work when invoked from the repository root.

It should resolve paths based on the script or repository location rather than assuming an arbitrary current working directory where possible.

Use the current process platform to select the appropriate pnpm executable when needed:

```ts
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
```

## 13. Required Post-Processing

After Vite scaffolding, the script must make only these required changes:

1. Set the generated `package.json` name to the experiment name.
2. Replace the default Vite React demo app with a minimal app that renders:
   - the experiment name
   - a short confirmation that the experiment is running
3. Remove the generated experiment-local `.gitignore`.
4. Remove unused Vite starter assets/files that are no longer needed after replacing the starter app.

Do not add `.env.example`.

Do not introduce backend code.

Keep the generated experiments frontend-only and simple.

## 14. Dependency and Reproducibility Policy

Each experiment must maintain:

- its own `package.json`
- its own `pnpm-lock.yaml`
- its own build configuration
- its own source code

Updating dependencies in one experiment must not update another experiment's `package.json` or lockfile.

The root repository must not run automated dependency updates across all experiments by default.

Do not configure Renovate, Dependabot, or a similar updater by default.

The create script does not need to normalize Vite-generated dependency ranges to exact versions. The initially scaffolded dependency ranges may remain as generated by Vite.

Future manual dependency additions should be saved exactly via the root `.npmrc`.

## 15. Shared Code Policy

Do not create shared packages in the initial implementation.

Do not add a `packages/*` workspace entry.

Experiments should remain self-contained.

## 16. README Requirements

Create a minimal root `README.md` covering only:

- prerequisites
- creating an experiment
- running an experiment
- building an experiment
- adding dependencies
- deleting an experiment

Document:

```text
Node.js 24.16.0
pnpm with Corepack enabled
```

Include setup commands:

```bash
corepack enable
pnpm --version
```

Creating an experiment:

```bash
pnpm experiment:new chat-streaming
```

Running an experiment:

```bash
pnpm --dir experiments/chat-streaming dev
```

Building an experiment:

```bash
pnpm --dir experiments/chat-streaming build
```

Adding dependencies:

```bash
pnpm --dir experiments/chat-streaming add ai
pnpm --dir experiments/chat-streaming add -D some-dev-package
```

Deleting an experiment:

```bash
rm -rf experiments/chat-streaming
```

Include a PowerShell equivalent:

```powershell
Remove-Item -Recurse -Force experiments/chat-streaming
```

Do not document environment variable conventions.

Do not document `experiment:list`.

Keep the README as small as possible.

## 17. Error Handling

The creation script must provide useful errors for:

- missing name
- invalid name
- existing destination
- Vite scaffolding failure
- dependency installation failure
- missing pnpm executable
- temporary directory cleanup issues when relevant

Do not expose full stack traces for expected validation errors.

For failed subprocesses, print a human-readable error plus relevant stderr.

## 18. Cross-Platform Compatibility

The scripts must work on:

- macOS
- Linux
- Windows

Do not rely on Unix-only shell commands inside Node scripts.

Use Node filesystem APIs instead of shell utilities such as:

```bash
cp
sed
rm
find
```

Root package scripts should call Node files rather than contain complex shell pipelines.

## 19. Acceptance Criteria

The task is complete when all of the following pass.

### Repository setup

- `pnpm install` at the root completes successfully.
- The repository contains the required root folders and files.
- No unnecessary monorepo framework is installed.

### Experiment creation

Running:

```bash
pnpm experiment:new chat-streaming
```

must:

- create `experiments/chat-streaming`
- set the package name to `chat-streaming`
- replace the default Vite app with the required minimal app
- install dependencies
- create a local `pnpm-lock.yaml`
- print a successful completion message

### Isolation

After creating two experiments:

```bash
pnpm experiment:new first-test
pnpm experiment:new second-test
```

both must contain separate lockfiles:

```text
experiments/first-test/pnpm-lock.yaml
experiments/second-test/pnpm-lock.yaml
```

Adding a dependency to `first-test` must not modify files inside `second-test`.

### Runtime

For a generated experiment:

```bash
pnpm --dir experiments/chat-streaming typecheck
pnpm --dir experiments/chat-streaming build
```

must both succeed.

Running:

```bash
pnpm --dir experiments/chat-streaming dev
```

must start the Vite development server.

Running:

```bash
pnpm --filter chat-streaming dev
```

must also work.

### Validation

The following must fail without creating final experiment directories:

```bash
pnpm experiment:new
pnpm experiment:new ChatStreaming
pnpm experiment:new chat_streaming
pnpm experiment:new ../chat
```

Creating an existing experiment must fail without overwriting it.

### Cleanup

If scaffolding or dependency installation fails during creation, the incomplete experiment directory must be removed.

Temporary directories created during generation must also be cleaned up.

## 20. Deliverables

Provide:

1. The repository structure.
2. All configuration files.
3. The TypeScript experiment creation script.
4. Root documentation.
5. A brief summary of implementation decisions.
6. Commands used to verify the acceptance criteria.

Create the working implementation from this spec when requested.

## 21. Explicitly Removed From the Earlier Draft

This specification intentionally does not require:

- `templates/react-vite/`
- `.env.example`
- `experiment:list`
- `packages/*`
- a rigid generated experiment file tree
- dependency version normalization of Vite-generated dependencies
