import type { IncomingMessage, ServerResponse } from 'node:http'

import { buildApp } from '../src/app.js'

const app = buildApp()
let readyPromise: Promise<void> | null = null

async function ensureReady() {
  if (!readyPromise) {
    readyPromise = app.ready().then(() => {})
  }
  await readyPromise
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ensureReady()
  app.server.emit('request', req, res)
}
