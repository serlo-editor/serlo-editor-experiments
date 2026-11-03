import { createLocalBackend } from "./local"
import { createPartyServerBackend } from "./partyserver"
import type { SyncBackend } from "./types"

export type { SyncBackend, SyncConnection } from "./types"

/**
 * Uses the sync server when its host is inlined at build time and the browser is online,
 * otherwise syncs between the tabs of this browser.
 */
export function createBackend(): SyncBackend {
  const host = readSyncHost()
  if (!host) return fallBackToLocal("PUBLIC_SYNC_HOST unset")
  if (!navigator.onLine) return fallBackToLocal("offline")
  // oxlint-disable-next-line no-console -- makes the active backend visible next to fallbacks
  console.info(`Sync backend: ${host}`)
  return createPartyServerBackend(host)
}

/** The silent fallback is easy to mistake for broken sync, so it is always logged. */
export function fallBackToLocal(reason: string): SyncBackend {
  // oxlint-disable-next-line no-console
  console.info(`Sync backend: local (${reason})`)
  return createLocalBackend()
}

/** Bun replaces only the literal `process.env.X`; when unset, the browser has no `process`. */
function readSyncHost(): string | undefined {
  try {
    return process.env.PUBLIC_SYNC_HOST
  } catch {
    return undefined
  }
}
