import { routePartykitRequest } from "partyserver"
import { YServer } from "y-partyserver"
import * as Y from "yjs"

interface Env {
  Document: DurableObjectNamespace<Document>
}

/** Serves `/parties/document/:room` for the editor's `PartyServerBackend`. */
export default {
  async fetch(request, env) {
    return (await routePartykitRequest(request, env)) ?? new Response("Not found", { status: 404 })
  },
} satisfies ExportedHandler<Env>

/** One Durable Object per room; its Yjs state survives hibernation in Durable Object storage. */
export class Document extends YServer {
  static override options = { hibernate: true }

  override async onLoad() {
    const state = await this.ctx.storage.get<Uint8Array>(storageKey)
    if (state) Y.applyUpdate(this.document, state)
  }

  override async onSave() {
    await this.ctx.storage.put(storageKey, Y.encodeStateAsUpdate(this.document))
  }
}

const storageKey = "document"
