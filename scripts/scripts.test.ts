import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import { test } from "node:test"

// Run with: bun test scripts/scripts.test.ts
// Executable Bun stub uses a POSIX shebang; no installs or real experiments touched.
test(
  "experiment creation, rollback, and Pages output",
  { skip: process.platform === "win32" },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "experiment-scripts-"))
    const bin = join(root, "bin")
    const source = join(root, "src")
    const template = join(root, "templates", "react")
    const reactPackage = {
      name: "template",
      dependencies: { react: "1" },
      devDependencies: { vite: "1" },
    }
    const env = {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH}`,
      PAGES_BASE_PATH: "",
      GITHUB_REPOSITORY: "",
    }
    const run = (script: string, args: string[] = [], overrides: NodeJS.ProcessEnv = {}) =>
      spawnSync(process.execPath, [join(root, "scripts", script), ...args], {
        cwd: root,
        env: { ...env, ...overrides },
        encoding: "utf8",
      })

    try {
      await cp(import.meta.dirname, join(root, "scripts"), { recursive: true })
      await mkdir(bin)
      await mkdir(source)
      await mkdir(join(template, "node_modules"), { recursive: true })
      await writeFile(join(template, "node_modules", "ignored"), "do not copy")
      await writeFile(join(template, "package.json"), JSON.stringify(reactPackage))
      await writeFile(
        join(bin, "bun"),
        `#!${process.execPath}
import { mkdirSync, writeFileSync } from "node:fs";
if (process.env.FAIL_BUN) {
  console.log("install stdout");
  console.error("install stderr");
  process.exit(7);
}
if (process.argv[2] === "install") {
  if (process.env.CI !== "1" || process.cwd() !== ${JSON.stringify(root)}) process.exit(8);
} else {
  mkdirSync("dist", { recursive: true });
  writeFileSync("dist/index.html", process.argv.slice(2).join(" "));
}
`,
        { mode: 0o755 },
      )

      for (const [args, message] of [
        [[], "Missing experiment name."],
        [
          ["react", "Bad_name"],
          "Invalid experiment name: Bad_name. Use kebab-case like chat-streaming.",
        ],
        [["", "valid-name"], "Missing template name."],
        [["unknown", "valid-name"], "Unknown template: unknown"],
      ] as const) {
        const result = run("create-experiment.ts", [...args])
        assert.equal(result.status, 1)
        assert.equal(result.stderr.trim(), message)
        assert.deepEqual(await readdir(source), [])
      }

      const created = run("create-experiment.ts", ["react", "valid-name"])
      assert.equal(created.status, 0, created.stderr)
      const [name] = await readdir(source)
      assert.ok(name && /^\d{4}-\d{2}-\d{2}-valid-name$/.test(name))
      assert.match(created.stdout, new RegExp(`Created src/${name}`))
      assert.deepEqual(JSON.parse(await readFile(join(source, name, "package.json"), "utf8")), {
        ...reactPackage,
        name,
      })
      assert.deepEqual(await readdir(join(source, name)), ["package.json"])

      const duplicate = run("create-experiment.ts", ["react", "valid-name"])
      assert.equal(duplicate.status, 1)
      assert.equal(duplicate.stderr.trim(), `Experiment already exists: src/${name}`)
      assert.deepEqual(await readdir(source), [name])

      const failed = run("create-experiment.ts", ["react", "failed-name"], { FAIL_BUN: "1" })
      assert.equal(failed.status, 1)
      assert.equal(
        failed.stderr.trim(),
        "Dependency installation failed with exit code 7.\ninstall stderr\ninstall stdout",
      )
      assert.deepEqual(await readdir(source), [name])

      const missingBun = run("create-experiment.ts", ["react", "missing-bun"], { PATH: "" })
      assert.equal(missingBun.status, 1)
      assert.equal(
        missingBun.stderr.trim(),
        "Missing Bun executable (bun). Please ensure Bun is installed and available on PATH.",
      )
      assert.deepEqual(await readdir(source), [name])

      await mkdir(join(source, "ts-only"))
      await writeFile(join(source, "ts-only", "package.json"), "{}")
      await writeFile(join(source, "ignored-file"), "not an experiment")
      const specialName = "a&<\"' experiment"
      await mkdir(join(source, specialName))
      await writeFile(join(source, specialName, "package.json"), JSON.stringify(reactPackage))

      for (const [overrides, base] of [
        [{}, "/"],
        [{ GITHUB_REPOSITORY: "owner/repo" }, "/repo/"],
        [{ PAGES_BASE_PATH: "///custom///", GITHUB_REPOSITORY: "owner/repo" }, "/custom/"],
        [{ PAGES_BASE_PATH: "/" }, "//"],
      ] as const) {
        const pages = run("build-github-pages.ts", [], overrides)
        assert.equal(pages.status, 0, pages.stderr)
        assert.equal(pages.stdout, `Building ${name}\nBuilding ${specialName}\n`)
        const index = await readFile(join(root, ".pages", "index.html"), "utf8")
        assert.ok(
          index.includes(
            `href="${base}${encodeURIComponent(specialName)}/">a&amp;&lt;&quot;&#39; experiment</a>`,
          ),
        )
        assert.deepEqual(
          (await readdir(join(root, ".pages"))).sort(),
          [name, specialName, "index.html"].sort(),
        )
        assert.equal(
          await readFile(join(root, ".pages", name, "index.html"), "utf8"),
          `run build --base ${base}${name}/`,
        )
      }

      const failedBuild = run("build-github-pages.ts", [], { FAIL_BUN: "1" })
      assert.notEqual(failedBuild.status, 0)
      assert.match(failedBuild.stderr, /failed with exit code 7/)
      assert.deepEqual(await readdir(join(root, ".pages")), [])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  },
)
