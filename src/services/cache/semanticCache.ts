import { createHash } from 'node:crypto'

type CacheEntry<T> = {
  value: T
  createdAt: number
}

type CacheOptions = {
  execute: boolean
  debug: boolean
}

const TTL_MS = 5 * 60 * 1000
const MAX_ENTRIES = 200

const cache = new Map<string, CacheEntry<unknown>>()

function normalizeQuestion(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildCacheKey(question: string, opts: CacheOptions) {
  const normalized = normalizeQuestion(question)
  const rawKey = `${normalized}|execute=${opts.execute ? 1 : 0}|debug=${opts.debug ? 1 : 0}`
  return createHash('sha256').update(rawKey).digest('hex')
}

function pruneIfNeeded() {
  if (cache.size <= MAX_ENTRIES) return
  const overflow = cache.size - MAX_ENTRIES
  const keys = cache.keys()
  for (let i = 0; i < overflow; i++) {
    const k = keys.next().value
    if (k) cache.delete(k)
  }
}

export function getCachedResponse<T>(question: string, opts: CacheOptions) {
  const key = buildCacheKey(question, opts)
  const entry = cache.get(key)
  if (!entry) return { hit: false, key }

  const ageMs = Date.now() - entry.createdAt
  if (ageMs > TTL_MS) {
    cache.delete(key)
    return { hit: false, key }
  }

  return { hit: true, key, ageMs, value: entry.value as T }
}

export function setCachedResponse<T>(question: string, opts: CacheOptions, value: T) {
  const key = buildCacheKey(question, opts)
  cache.set(key, { value, createdAt: Date.now() })
  pruneIfNeeded()
}
