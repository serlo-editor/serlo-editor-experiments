# AGENTS

- Read `README.md` to understand repository purpose and structure.
- Use `gh issue --help` to find commands for retrieving or creating GitHub issues.
- Experiments are independent of each other and should only be read for a task if the user explicitly asks for this or links them in the conversation.
- Create experiments with `bun run new <template> <name>` with possible values "ts" and "react" for `<template>`.
- Name experiments in the format `src/YYYY-MM-DD-<name>`. Valid names must be kebab-case.
- Order code from general to concrete: start with the most abstract function, then the functions it calls, and so on.
- Avoid TypeScript `as` assertions. Prefer accurate type definitions and inference; use assertions only when runtime guarantees cannot be expressed otherwise.
- Do not add runtime checks or tests for invalid arguments that TypeScript already rejects in typed code. Keep runtime validation for data outside TypeScript's guarantees, such as persisted or remote data, and for invalid values allowed by the types.
- Keep spec files focused on their own module's public behavior. Assert observable results after calls, not implementation details or internals of other modules. Minimize redundant cases; retain type tests where types are the contract (for example, branded types).
- Run `bun run fix` after every change to check formatting and linting. For experiment changes, run it from the affected package using `bun run --cwd <package-path> fix`.
- For browser E2E on this workstation, use Bun.WebView with `BUN_CHROME_PATH="$HOME/.cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell"` and Chrome backend `argv: ["--no-sandbox", "--disable-dev-shm-usage"]`. This uses the MS Playwright-installed headless-shell binary, not the Playwright API or a separate Chromium installation.
