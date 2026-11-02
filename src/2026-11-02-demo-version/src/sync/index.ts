import { createLiveblocksBackend } from "./liveblocks"
import { createLocalBackend } from "./local"
import type { SyncBackend } from "./types"

export type { SyncBackend, SyncConnection } from "./types"

/**
 * Uses Liveblocks when a public key is inlined at build time and the browser is online,
 * otherwise syncs within the page.
 */
export function createBackend(): SyncBackend {
  const publicApiKey = readLiveblocksPublicKey()
  if (!publicApiKey) return fallBackToLocal("LIVEBLOCKS_PUBLIC unset")
  if (!navigator.onLine) return fallBackToLocal("offline")
  // oxlint-disable-next-line no-console -- makes the active backend visible next to fallbacks
  console.info("Sync backend: Liveblocks")
  return createLiveblocksBackend(publicApiKey)
}

/** The silent fallback is easy to mistake for broken sync, so it is always logged. */
export function fallBackToLocal(reason: string): SyncBackend {
  // oxlint-disable-next-line no-console
  console.info(`Sync backend: local (${reason})`)
  return createLocalBackend()
}

/** Bun replaces only the literal `process.env.X`; when unset, the browser has no `process`. */
function readLiveblocksPublicKey(): string | undefined {
  try {
    return process.env.LIVEBLOCKS_PUBLIC
  } catch {
    return undefined
  }
}
