import { spawn } from "node:child_process";
import { access, cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const experimentsRoot = join(repoRoot, "experiments");
const experimentNamePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

class UserError extends Error {}

async function main() {
  let tempDir = "";
  let finalDir = "";
  let shouldCleanupFinalDir = false;
  let pnpmCacheDir = "";

  try {
    const name = validateName(process.argv[2]);
    finalDir = join(experimentsRoot, name);

    await mkdir(experimentsRoot, { recursive: true });

    if (await exists(finalDir)) {
      throw new UserError(`Experiment already exists: ${pathForMessage(finalDir)}`);
    }

    tempDir = await mkdtemp(join(tmpdir(), "serlo-editor-experiment-"));
    pnpmCacheDir = await mkdtemp(join(tmpdir(), "serlo-editor-pnpm-cache-"));

    await runPnpm([
      "create",
      "vite",
      tempDir,
      "--template",
      "react-ts",
    ], repoRoot, "Vite scaffolding", pnpmCacheDir);

    await postProcessScaffold(tempDir, name);

    await runPnpm(["--dir", tempDir, "install"], repoRoot, "Dependency installation", pnpmCacheDir);

    if (!(await exists(join(tempDir, "pnpm-lock.yaml")))) {
      throw new Error("Dependency installation did not produce pnpm-lock.yaml.");
    }

    shouldCleanupFinalDir = true;
    await moveDirectory(tempDir, finalDir);

    console.log(`Created ${pathForMessage(finalDir)}`);
    console.log(`Next:`);
    console.log(`  pnpm --dir experiments/${name} dev`);
    console.log(`  pnpm --filter ${name} dev`);
    console.log(`  pnpm --dir experiments/${name} build`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (shouldCleanupFinalDir && finalDir) {
      try {
        await rm(finalDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup failures; the original error is more important.
      }
    }

    if (tempDir) {
      try {
        await rm(tempDir, { recursive: true, force: true });
      } catch {
        console.error(`Warning: failed to clean up temporary directory ${tempDir}`);
      }
    }

    if (pnpmCacheDir) {
      try {
        await rm(pnpmCacheDir, { recursive: true, force: true });
      } catch {
        console.error(`Warning: failed to clean up pnpm cache directory ${pnpmCacheDir}`);
      }
    }

    console.error(message);
    process.exitCode = 1;
  }
}

function validateName(nameArg: string | undefined) {
  if (!nameArg) {
    throw new UserError("Missing experiment name.");
  }

  if (!experimentNamePattern.test(nameArg)) {
    throw new UserError(
      `Invalid experiment name: ${nameArg}. Use kebab-case like chat-streaming.`,
    );
  }

  return nameArg;
}

async function postProcessScaffold(tempDir: string, name: string) {
  const packageJsonPath = join(tempDir, "package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    name?: string;
    scripts?: Record<string, string>;
  };

  packageJson.name = name;
  packageJson.scripts = {
    ...packageJson.scripts,
    typecheck: "tsc --noEmit",
  };

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  await writeFile(
    join(tempDir, "src", "App.tsx"),
    `export default function App() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>${name}</h1>
      <p>The experiment is running.</p>
    </main>
  );
}
`,
  );

  await writeFile(
    join(tempDir, "src", "main.tsx"),
    `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
  );

  await writeFile(
    join(tempDir, "index.html"),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  );

  await Promise.all(
    [
      ".gitignore",
      "README.md",
      join("src", "assets"),
      join("src", "index.css"),
      join("src", "App.css"),
      join("public"),
    ].map((path) => rm(join(tempDir, path), { recursive: true, force: true })),
  );
}

async function moveDirectory(source: string, destination: string) {
  try {
    await rename(source, destination);
    return;
  } catch (error) {
    if (!isCrossDeviceError(error)) {
      throw error;
    }
  }

  await cp(source, destination, { recursive: true, errorOnExist: true });
  await rm(source, { recursive: true, force: true });
}

async function runPnpm(
  args: string[],
  cwd: string,
  label: string,
  cacheDir: string,
) {
  const child = spawn(pnpmCommand, args, {
    cwd,
    env: {
      ...process.env,
      CI: "1",
      XDG_CACHE_HOME: cacheDir,
      npm_config_cache: cacheDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout?.on("data", (chunk: { toString(): string }) => {
    stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk: { toString(): string }) => {
    stderr += chunk.toString();
  });

  return await new Promise<void>((resolvePromise, rejectPromise) => {
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        rejectPromise(
          new Error(
            `Missing pnpm executable (${pnpmCommand}). Please ensure pnpm is installed and available on PATH.`,
          ),
        );
        return;
      }

      rejectPromise(new Error(`${label} failed to start: ${error.message}`));
    });

    child.on("close", (code: number | null) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      const details = [stderr.trim(), stdout.trim()].filter(Boolean).join("\n");
      rejectPromise(
        new Error(
          `${label} failed${code === null ? "" : ` with exit code ${code}`}.${details ? `\n${details}` : ""}`,
        ),
      );
    });
  });
}

async function exists(path: string) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }

    throw error;
  }
}

function isMissingFileError(error: unknown) {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT";
}

function isCrossDeviceError(error: unknown) {
  return error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "EXDEV";
}

function pathForMessage(path: string) {
  return path.startsWith(repoRoot) ? path.slice(repoRoot.length + 1) : path;
}

void main();
