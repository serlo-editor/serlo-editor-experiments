# Sync server (Cloudflare Workers + y-partyserver)

Small Cloudflare Worker that syncs the editor's Yjs documents. Each room (one per exercise type)
is its own Durable Object, which keeps the document in Durable Object storage while nobody is
connected. The frontend connects to it via `src/sync/partyserver.ts`.

The frontend only uses the server when `PUBLIC_SYNC_HOST` is set at build time. Without it, or when
the server can't be reached within 8 seconds, it falls back to syncing the tabs of one browser via
`BroadcastChannel` (`src/sync/local.ts`).

## One-time setup

All commands run in `src/2026-11-02-demo-version`.

1. Create a free Cloudflare account at <https://dash.cloudflare.com/sign-up>.
2. Log in with Wrangler. This opens the browser:

   ```bash
   bunx wrangler login
   ```

3. Deploy the worker:

   ```bash
   bun run server:deploy
   ```

   On the first deploy, Wrangler asks you to register a `workers.dev` subdomain for your account.
   At the end it prints the worker URL, e.g.
   `https://serlo-editor-demo-sync.<your-subdomain>.workers.dev`.

4. Check that the worker answers. A `404 Not found` for the root path is expected:

   ```bash
   curl -i https://serlo-editor-demo-sync.<your-subdomain>.workers.dev/
   ```

## Use it from GitHub Pages

1. Set the host as a repository variable. Use the host only, without `https://`; the client picks
   `wss://` itself:

   ```bash
   gh variable set PUBLIC_SYNC_HOST --body "serlo-editor-demo-sync.collab-editor-server.workers.dev"
   ```

2. Push to `main`. The Pages workflow passes `PUBLIC_SYNC_HOST` to `bun run build`, which inlines only
   `PUBLIC_*` variables into the bundle.
3. Open the deployed page. The browser console should log
   `Sync backend: serlo-editor-demo-sync.<your-subdomain>.workers.dev`.

## Use it during local development

By default `bun run dev` has no `PUBLIC_SYNC_HOST` and syncs only between tabs of your browser. To
sync through a server, copy `.env.example` to `.env`, enable one of these lines and restart
`bun run dev`:

```bash
# the deployed worker
PUBLIC_SYNC_HOST=serlo-editor-demo-sync.<your-subdomain>.workers.dev

# or a local worker, started with `bun run server:dev` (no Cloudflare login needed)
PUBLIC_SYNC_HOST=localhost:8787
```

## Updating the worker

Run `bun run server:deploy` again after changing `server/`. Content stays in the Durable Objects'
storage. If you rename the `Document` class, add a new migration in `wrangler.jsonc` instead of
editing the existing `v1` entry.

## Limits and caveats

- There is no authentication: anyone who knows the host can read and edit every room. That's fine for
  a demo, not for real content.
- Stay on the Workers **Free** plan and don't add a payment method. On the Free plan, exceeding a
  limit makes further operations of that type fail until the daily reset at 00:00 UTC; nothing is
  billed. A spending limit is therefore not needed.

## Free plan limits

Daily limits, reset at 00:00 UTC (as of November 2026, see
[Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) and
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/)):

| Limit                          | Free plan   | What uses it here                                                                   |
| ------------------------------ | ----------- | ----------------------------------------------------------------------------------- |
| Requests (Workers + DO)        | 100,000     | 7 per page load (one WebSocket per room), plus 1 per 20 incoming WebSocket messages |
| Durable Object duration        | 13,000 GB-s | Time a room is awake. Hibernation keeps idle rooms from counting                    |
| SQLite rows written            | 100,000     | `onSave`, at most every 2–10 s per room while someone edits                         |
| SQLite rows read               | 5,000,000   | `onLoad` when a room wakes up                                                       |
| Stored data (total, not daily) | 5 GB        | One Yjs document per room, a few KB each                                            |

Rough estimate for this demo: an open tab sends presence updates every 15 s in each of the 7
rooms, about 2,000 requests per day if left open all day. Typing and cursor moves add messages,
but at a 20:1 ratio. Even with many reloads during a demo day, you stay far below 100,000.

If a limit is hit anyway, the worker returns errors until midnight UTC, and the frontend falls
back to local sync after its 8-second timeout. Usage is visible in the Cloudflare dashboard under
Workers & Pages → `serlo-editor-demo-sync` → Metrics.

## Leftovers from Liveblocks

- Remove `LIVEBLOCKS_PUBLIC` and `LIVEBLOCKS_SECRET` from `.env`.
- Delete the old repository variable: `gh variable delete LIVEBLOCKS_PUBLIC`.
