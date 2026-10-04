import { spawn } from "node:child_process"
import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname, join, relative, resolve, sep } from "node:path"

const bunCommand = process.platform === "win32" ? "bun.exe" : "bun"
const repoRoot = resolve(import.meta.dirname, "..")
const namePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

async function main() {
  let cleanupDir: string | undefined
  try {
    const templateName = process.argv[2]
    const name = validateName(process.argv[3])
    const experimentDirName = `${formatLocalDate(new Date())}-${name}`
    const finalDirRelative = join("src", experimentDirName)
    const finalDir = join(repoRoot, finalDirRelative)

    if (!templateName) {
      throw new Error("Missing template name.")
    }

    const templateDir = resolve(repoRoot, "templates", templateName)

    if (!(await exists(templateDir))) {
      throw new Error(`Unknown template: ${templateName}`)
    }

    if (await exists(finalDir)) {
      throw new Error(`Experiment already exists: ${finalDirRelative}`)
    }

    await mkdir(dirname(finalDir), { recursive: true })
    cleanupDir = finalDir

    await copyTemplate(templateDir, finalDir)
    await updatePackageName(finalDir, experimentDirName)

    await installDependencies()

    console.log(`Created ${finalDirRelative}`)
    console.log(`Next:`)
    console.log(`  bun --cwd ${finalDirRelative} run dev`)
    console.log(`  bun --cwd ${finalDirRelative} run build`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (cleanupDir) {
      try {
        await rm(cleanupDir, { recursive: true, force: true })
      } catch {
        console.error(`Warning: Error while cleaning up ${cleanupDir}`)
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

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function validateName(nameArg: string | undefined) {
  if (!nameArg) {
    throw new Error("Missing experiment name.")
  }

  if (!namePattern.test(nameArg)) {
    throw new Error(`Invalid experiment name: ${nameArg}. Use kebab-case like chat-streaming.`)
  }

  return nameArg
}

function installDependencies() {
  const child = spawn(bunCommand, ["install"], {
    cwd: repoRoot,
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

  return new Promise<void>((resolvePromise, rejectPromise) => {
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        rejectPromise(
          new Error(
            `Missing Bun executable (${bunCommand}). Please ensure Bun is installed and available on PATH.`,
          ),
        )
        return
      }

      rejectPromise(new Error(`Dependency installation failed to start: ${error.message}`))
    })

    child.on("close", (code: number | null) => {
      if (code === 0) {
        resolvePromise()
        return
      }

      const details = [stderr.trim(), stdout.trim()].filter(Boolean).join("\n")
      rejectPromise(
        new Error(
          `Dependency installation failed${code === null ? "" : ` with exit code ${code}`}.${details ? `\n${details}` : ""}`,
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
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false
    }

    throw error
  }
}

void main()
