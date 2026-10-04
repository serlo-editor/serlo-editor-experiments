import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import { test } from "node:test"

// Run with: bun test scripts/build-github-pages.spec.ts
// Executable Bun stub uses a POSIX shebang; no builds or real experiments touched.
test(
  "Pages discovery, output, and build failures",
  { skip: process.platform === "win32" },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "pages-script-"))
    const bin = join(root, "bin")
    const source = join(root, "src")
    const name = "2026-10-04-valid-name"
    const specialName = "a&<\"' experiment"
    const reactPackage = { dependencies: { react: "1" }, devDependencies: { vite: "1" } }
    const env = {
      ...process.env,
      PATH: `${bin}${delimiter}${process.env.PATH}`,
      PAGES_BASE_PATH: "",
      GITHUB_REPOSITORY: "",
      FAIL_BUN: "",
    }
    const run = (overrides: NodeJS.ProcessEnv = {}) =>
      spawnSync(process.execPath, [join(root, "scripts", "build-github-pages.ts")], {
        cwd: root,
        env: { ...env, ...overrides },
        encoding: "utf8",
      })

    try {
      await mkdir(join(root, "scripts"))
      await cp(
        join(import.meta.dirname, "build-github-pages.ts"),
        join(root, "scripts", "build-github-pages.ts"),
      )
      await mkdir(bin)
      await mkdir(source)
      await writeFile(
        join(bin, "bun"),
        `#!${process.execPath}
import { mkdirSync, writeFileSync } from "node:fs";
if (process.env.FAIL_BUN) {
  console.error("build failed");
  process.exit(7);
}
mkdirSync("dist", { recursive: true });
writeFileSync("dist/index.html", process.argv.slice(2).join(" "));
`,
        { mode: 0o755 },
      )
      for (const experiment of [name, specialName]) {
        await mkdir(join(source, experiment))
        await writeFile(join(source, experiment, "package.json"), JSON.stringify(reactPackage))
      }
      await mkdir(join(source, "ts-only"))
      await writeFile(join(source, "ts-only", "package.json"), "{}")
      await writeFile(join(source, "ignored-file"), "not an experiment")

      for (const [overrides, base] of [
        [{}, "/"],
        [{ GITHUB_REPOSITORY: "owner/repo" }, "/repo/"],
        [{ PAGES_BASE_PATH: "///custom///", GITHUB_REPOSITORY: "owner/repo" }, "/custom/"],
        [{ PAGES_BASE_PATH: "/" }, "//"],
      ] as const) {
        const pages = run(overrides)
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

      const failedBuild = run({ FAIL_BUN: "1" })
      assert.notEqual(failedBuild.status, 0)
      assert.match(failedBuild.stderr, /failed with exit code 7/)
      assert.deepEqual(await readdir(join(root, ".pages")), [])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  },
)
