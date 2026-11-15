import { watch } from "node:fs"
import { join } from "node:path"

const root = import.meta.dir
const dist = join(root, "dist")

async function build() {
  const result = await Bun.build({
    entrypoints: [join(root, "src/index.html")],
    outdir: dist,
    target: "browser",
  })
  if (!result.success) console.error(...result.logs)
}

await build()

Bun.serve({
  port: process.env.PORT ?? 3000,
  async fetch(request) {
    const pathname = new URL(request.url).pathname
    const file = Bun.file(join(dist, pathname === "/" ? "index.html" : pathname.slice(1)))
    return (await file.exists()) ? new Response(file) : new Response("Not found", { status: 404 })
  },
})

let timer: ReturnType<typeof setTimeout>
watch(join(root, "src"), { recursive: true }, () => {
  clearTimeout(timer)
  timer = setTimeout(build, 100)
})

console.log(`Dev server ready at http://localhost:${process.env.PORT ?? 3000}/`)
