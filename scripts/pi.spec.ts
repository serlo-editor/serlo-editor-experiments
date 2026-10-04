import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import { test } from "node:test"

// Run with: bun test scripts/pi.spec.ts
// Stub nono; no sandbox or pi session started.
test(
  "pi invokes nono with sandbox arguments and preserves exit status",
  { skip: process.platform === "win32" },
  async () => {
    const root = await mkdtemp(join(tmpdir(), "pi-script-"))
    try {
      await writeFile(
        join(root, "nono"),
        `#!${process.execPath}
console.log(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }));
process.exit(Number(process.env.NONO_EXIT));
`,
        { mode: 0o755 },
      )
      for (const status of [0, 7]) {
        const result = spawnSync("/bin/bash", [join(import.meta.dirname, "pi")], {
          cwd: root,
          env: {
            ...process.env,
            PATH: `${root}${delimiter}${process.env.PATH}`,
            NONO_EXIT: String(status),
          },
          encoding: "utf8",
        })
        assert.equal(result.status, status, result.stderr)
        assert.deepEqual(JSON.parse(result.stdout), {
          args: ["run", "--allow", ".", "--profile", "pi", "--", "pi"],
          cwd: root,
        })
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  },
)
