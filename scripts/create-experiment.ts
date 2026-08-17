import { spawn } from "node:child_process"
import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const namePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

class UserError extends Error {}

async function main() {
  let finalDirRelative = ""
  let finalDir = ""
  let shouldCleanupFinalDir = false
  try {
    const templateName = process.argv[2]
    const name = validateName(process.argv[3])
    const experimentDirName = createExperimentDirName(name)
    finalDirRelative = join("experiments", experimentDirName)
    finalDir = join(repoRoot, finalDirRelative)

    if (!templateName) {
      throw new UserError("Missing template name.")
    }

    const templateDir = resolve(repoRoot, "templates", templateName)

    if (!(await exists(templateDir))) {
      throw new UserError(`Unknown template: ${templateName}`)
    }

    if (await exists(finalDir)) {
      throw new UserError(`Experiment already exists: ${finalDirRelative}`)
    }

    await mkdir(dirname(finalDir), { recursive: true })
    shouldCleanupFinalDir = true

    await copyTemplate(templateDir, finalDir)
    await updatePackageName(finalDir, experimentDirName)

    await runPnpm({
      args: ["--dir", finalDirRelative, "install"],
      cwd: repoRoot,
      label: "Dependency installation",
    })

    console.log(`Created ${finalDirRelative}`)
    console.log(`Next:`)
    console.log(`  pnpm --dir ${finalDirRelative} dev`)
    console.log(`  pnpm --filter ${experimentDirName} dev`)
    console.log(`  pnpm --dir ${finalDirRelative} build`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (shouldCleanupFinalDir && finalDir) {
      try {
        await rm(finalDir, { recursive: true, force: true })
      } catch {
        console.error(`Warning: Error while cleaning up ${finalDir}`)
      }
    }

    console.error(message)
    process.exitCode = 1
  }
}

async function copyTemplate(templateDir: string, destinationDir: string) {
  await cp(templateDir, destinationDir, {
    filter: (source) => !isNodeModulesPath(templateDir, source),
    force: false,
    recursive: true,
  })
}

async function updatePackageName(experimentDir: string, name: string) {
  const packageJsonPath = join(experimentDir, "package.json")
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as { name?: string }

  packageJson.name = name

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
}

function isNodeModulesPath(templateDir: string, source: string) {
  const relativePath = relative(templateDir, source)
  return relativePath === "node_modules" || relativePath.startsWith(`node_modules${sep}`)
}

function createExperimentDirName(name: string) {
  const date = formatLocalDate(new Date())
  return `${date}-${name}`
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function validateName(nameArg: string | undefined) {
  if (!nameArg) {
    throw new UserError("Missing experiment name.")
  }

  if (!namePattern.test(nameArg)) {
    throw new UserError(`Invalid experiment name: ${nameArg}. Use kebab-case like chat-streaming.`)
  }

  return nameArg
}

async function runPnpm({ args, cwd, label }: { args: string[]; cwd: string; label: string }) {
  const child = spawn(pnpmCommand, args, {
    cwd,
    env: {
      ...process.env,
      CI: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  })

  let stdout = ""
  let stderr = ""

  child.stdout?.on("data", (chunk: { toString(): string }) => {
    stdout += chunk.toString()
  })
  child.stderr?.on("data", (chunk: { toString(): string }) => {
    stderr += chunk.toString()
  })

  return await new Promise<void>((resolvePromise, rejectPromise) => {
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        rejectPromise(
          new Error(
            `Missing pnpm executable (${pnpmCommand}). Please ensure pnpm is installed and available on PATH.`,
          ),
        )
        return
      }

      rejectPromise(new Error(`${label} failed to start: ${error.message}`))
    })

    child.on("close", (code: number | null) => {
      if (code === 0) {
        resolvePromise()
        return
      }

      const details = [stderr.trim(), stdout.trim()].filter(Boolean).join("\n")
      rejectPromise(
        new Error(
          `${label} failed${code === null ? "" : ` with exit code ${code}`}.${details ? `\n${details}` : ""}`,
        ),
      )
    })
  })
}

async function exists(path: string) {
  try {
    await access(path)
    return true
  } catch (error) {
    if (isMissingFileError(error)) {
      return false
    }

    throw error
  }
}

function isMissingFileError(error: unknown) {
  return (
    error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
  )
}

void main()
