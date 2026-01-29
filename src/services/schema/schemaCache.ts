import type { ColumnInfo } from './schemaLoader.js'
import { loadSchema } from './schemaLoader.js'

type SchemaCache = {
  loadedAt: number
  ttlMs: number
  data: Record<string, ColumnInfo[]> | null
}

const cache: SchemaCache = {
  loadedAt: 0,
  ttlMs: 5 * 60 * 1000, // 5 min
  data: null,
}

export async function getSchemaCached() {
  const now = Date.now()
  if (cache.data && now - cache.loadedAt < cache.ttlMs) return cache.data

  const schema = await loadSchema()
  cache.data = schema
  cache.loadedAt = now
  return schema
}
