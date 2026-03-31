import { create, insert, search as oramaSearch } from '@orama/orama'
import type { AnyOrama, SearchParams } from '@orama/orama'

export interface OramaPluginOptions<T> {
  schema: { [K in keyof T]?: 'string' | 'number' | 'boolean' | 'string[]' }
}

export function oramaIndexPlugin<T extends Record<string, unknown>>(
  options: OramaPluginOptions<T>
) {
  let db: AnyOrama | null = null

  return {
    onIndexReady: (items: T[]): void => {
      db = create({ schema: options.schema as Record<string, 'string' | 'number' | 'boolean'> })
      for (const item of items) {
        insert(db, item as Parameters<typeof insert>[1])
      }
    },

    search: async (query: string, opts?: { limit?: number }) => {
      if (!db) throw new Error('[CL3/orama] Index not ready. Call getCollection first.')
      return oramaSearch(db, { term: query, limit: opts?.limit ?? 10 } as SearchParams<any>)
    },

    getDb: () => db,
  }
}
