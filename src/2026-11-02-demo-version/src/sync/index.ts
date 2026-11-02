import { createLiveblocksBackend } from "./liveblocks"
import { createLocalBackend } from "./local"
import type { SyncBackend } from "./types"

export type { SyncBackend, SyncConnection } from "./types"

/** Uses Liveblocks when a public key is inlined at build time, otherwise syncs within the page. */
export function createBackend(): SyncBackend {
  const publicApiKey = readLiveblocksPublicKey()
  // oxlint-disable-next-line no-console -- the silent fallback is easy to mistake for broken sync
  console.info(`Sync backend: ${publicApiKey ? "Liveblocks" : "local (LIVEBLOCKS_PUBLIC unset)"}`)
  return publicApiKey ? createLiveblocksBackend(publicApiKey) : createLocalBackend()
}

/** Bun replaces only the literal `process.env.X`; when unset, the browser has no `process`. */
function readLiveblocksPublicKey(): string | undefined {
  try {
    return process.env.LIVEBLOCKS_PUBLIC
  } catch {
    return undefined
  }
}
