import type { CL3Cache } from './types.js'

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export function createMemoryCache(): CL3Cache {
  const store = new Map<string, CacheEntry<unknown>>()
  const DEFAULT_TTL = 60_000

  return {
    get<T>(key: string): T | undefined {
      const entry = store.get(key)
      if (!entry) return undefined
      if (Date.now() > entry.expiresAt) {
        store.delete(key)
        return undefined
      }
      return entry.value as T
    },
    set<T>(key: string, value: T, ttl = DEFAULT_TTL): void {
      store.set(key, { value, expiresAt: Date.now() + ttl })
    },
    invalidate(key: string): void {
      store.delete(key)
    },
  }
}
