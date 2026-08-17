# AGENTS

- Experiments are independent of each other and should only be read for a task if the user explicitly asks for this or links them in the conversation.
- Create experiments with `pnpm new <template> <name>`.
- Since only experiments / prototpyes are added to the repository, avoid adding any kind of tests (no e2e tests / no unit tests).
- The `templates/react` and `templates/ts` directories are the current templates for newly generated experiments.
- Name experiments in the format `experiments/YYYY-MM-DD-<name>`.
- Valid names must be kebab-case.
- Prefer simple implementations: be a lazy developer, follow KISS, and remember that the best code is code not added.
- Order code from general to concrete: start with the most abstract function, then the functions it calls, and so on.
