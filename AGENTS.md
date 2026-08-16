# AGENTS

- Create experiments with `pnpm new <name>`.
- Since only experiments / prototpyes are added to the repository, avoid adding any kind of tests (no e2e tests / no unit tests).
- The `dir template` directory is the template for newly generated experiments.
- Name experiments in the format `experiments/YYYY-MM-DD-NN-<name>`, where `NN` is an ongoing number to avoid conflicts when multiple experiments are added.
- Valid names must be kebab-case.
- Prefer simple implementations: be a lazy developer, follow KISS, and remember that the best code is code not added.
- Order code from general to concrete: start with the most abstract function, then the functions it calls, and so on.
