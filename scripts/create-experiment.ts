import { spawn } from "node:child_process"
import { access, mkdir, rm } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const experimentsRoot = join(repoRoot, "experiments")
const experimentNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

class UserError extends Error {}

async function main() {
  let finalDir = ""
  let shouldCleanupFinalDir = false
  try {
    const name = validateName(process.argv[2])
    finalDir = join(experimentsRoot, name)

    await mkdir(experimentsRoot, { recursive: true })

    if (await exists(finalDir)) {
      throw new UserError(`Experiment already exists: ${pathForMessage(finalDir)}`)
    }
    await moveDirectory(tempDir, finalDir)

    await runPnpm({
      args: ["create", "vite", finalDir, "--template", "react-ts", "--no-immediate"],
      cwd: repoRoot,
      label: "Vite scaffolding",
    })

    await runPnpm({
      args: ["--dir", finalDir, "install"],
      cwd: repoRoot,
      label: "Dependency installation",
    })

    shouldCleanupFinalDir = true

    console.log(`Created ${pathForMessage(finalDir)}`)
    console.log(`Next:`)
    console.log(`  pnpm --dir experiments/${name} dev`)
    console.log(`  pnpm --filter ${name} dev`)
    console.log(`  pnpm --dir experiments/${name} build`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (shouldCleanupFinalDir && finalDir) {
      try {
        await rm(finalDir, { recursive: true, force: true })
      } catch {
        // Ignore cleanup failures; the original error is more important.
      }
    }

    console.error(message)
    process.exitCode = 1
  }
}

function validateName(nameArg: string | undefined) {
  if (!nameArg) {
    throw new UserError("Missing experiment name.")
  }

  if (!experimentNamePattern.test(nameArg)) {
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

function pathForMessage(path: string) {
  return path.startsWith(repoRoot) ? path.slice(repoRoot.length + 1) : path
}

void main()
