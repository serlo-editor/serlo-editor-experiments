import { spawn } from "node:child_process"
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"

const bunCommand = process.platform === "win32" ? "bun.exe" : "bun"
const repoRoot = resolve(import.meta.dirname, "..")
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
        const packageJson = JSON.parse(
          await readFile(join(dir, "package.json"), "utf8"),
        ) as PackageJson

        if (!packageJson.dependencies?.react || !packageJson.devDependencies?.vite) {
          return undefined
        }

        return { dir, name: entry.name }
      }),
  )

  return experiments
    .filter((experiment) => experiment !== undefined)
    .sort((left, right) => left.name.localeCompare(right.name))
}

async function buildExperiment({ dir, name }: Experiment, basePath: string) {
  console.log(`Building ${name}`)
  const args = ["run", "build", "--base", `${basePath}${name}/`]
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(bunCommand, args, { cwd: dir, stdio: "inherit" })

    child.on("error", rejectPromise)
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }

      rejectPromise(new Error(`${bunCommand} ${args.join(" ")} failed with exit code ${code}`))
    })
  })
  await cp(join(dir, "dist"), join(outputDir, name), { recursive: true })
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
    return `/${configuredBasePath.replace(/^\/+|\/+$/g, "")}/`
  }

  const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1]
  return repositoryName ? `/${repositoryName}/` : "/"
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    '"': "&quot;",
    "&": "&amp;",
    "'": "&#39;",
    "<": "&lt;",
    ">": "&gt;",
  }
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character)
}

void main()
