import { spawn } from "node:child_process"
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const sourceDir = join(repoRoot, "src")
const outputDir = join(repoRoot, ".pages")

interface PackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

interface Experiment {
  dir: string
  name: string
}

async function main() {
  const basePath = getBasePath()
  const experiments = await findReactExperiments()

  await rm(outputDir, { force: true, recursive: true })
  await mkdir(outputDir, { recursive: true })

  for (const experiment of experiments) {
    await buildExperiment(experiment, basePath)
  }

  await writeIndex(experiments, basePath)
}

async function findReactExperiments() {
  const entries = await readdir(sourceDir, { withFileTypes: true })
  const experiments = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const dir = join(sourceDir, entry.name)
        const packageJson = await readPackageJson(dir)

        if (!packageJson.dependencies?.react || !packageJson.devDependencies?.vite) {
          return undefined
        }

        return { dir, name: entry.name }
      }),
  )

  return experiments
    .filter((experiment): experiment is Experiment => experiment !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name))
}

async function buildExperiment(experiment: Experiment, basePath: string) {
  console.log(`Building ${experiment.name}`)
  await run(pnpmCommand, ["install", "--frozen-lockfile"], experiment.dir)
  await run(pnpmCommand, ["build", "--base", `${basePath}${experiment.name}/`], experiment.dir)
  await cp(join(experiment.dir, "dist"), join(outputDir, experiment.name), { recursive: true })
}

async function writeIndex(experiments: Experiment[], basePath: string) {
  const links = experiments
    .map(
      ({ name }) =>
        `      <li><a href="${basePath}${encodeURIComponent(name)}/">${escapeHtml(name)}</a></li>`,
    )
    .join("\n")

  await writeFile(
    join(outputDir, "index.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Serlo Editor experiments</title>
  </head>
  <body>
    <h1>Serlo Editor experiments</h1>
    <ul>
${links}
    </ul>
  </body>
</html>
`,
  )
}

function getBasePath() {
  const configuredBasePath = process.env.PAGES_BASE_PATH
  if (configuredBasePath) {
    return normalizeBasePath(configuredBasePath)
  }

  const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1]
  return repositoryName ? `/${repositoryName}/` : "/"
}

function normalizeBasePath(basePath: string) {
  return `/${basePath.replace(/^\/+|\/+$/g, "")}/`
}

async function readPackageJson(dir: string) {
  const content = await readFile(join(dir, "package.json"), "utf8")
  return JSON.parse(content) as PackageJson
}

async function run(command: string, args: string[], cwd: string) {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" })

    child.on("error", rejectPromise)
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }

      rejectPromise(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`))
    })
  })
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '"': "&quot;",
      "&": "&amp;",
      "'": "&#39;",
      "<": "&lt;",
      ">": "&gt;",
    }
    return entities[character] ?? character
  })
}

void main()
