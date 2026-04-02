import type { CollectionSource } from 'contentlayer3'
import { CL3SourceError, type RemoteSourceOptions } from './types.js'

export { CL3SourceError, type RemoteSourceOptions } from './types.js'

function buildUrl(endpoint: string, params: Record<string, string | number>): string {
  const url = new URL(endpoint)
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, String(value))
  })
  return url.toString()
}

export function remote(options: RemoteSourceOptions): CollectionSource<unknown> {
  return {
    async load(): Promise<unknown[]> {
      const {
        endpoint,
        headers,
        transform,
        pagination,
        timeout = 10000,
      } = options

      if (!pagination || pagination.strategy === 'none') {
        const signal = AbortSignal.timeout(timeout)
        const response = await fetch(endpoint, {
          headers,
          signal,
        })

        if (!response.ok) {
          throw new CL3SourceError(
            `Remote source fetch failed: HTTP ${response.status}`,
            response.status
          )
        }

        const raw = await response.json()
        const items = transform ? transform(raw) : (Array.isArray(raw) ? raw : [])
        return items
      }

      if (pagination.strategy === 'offset') {
        const pageSize = pagination.pageSize
        if (!pageSize) {
          throw new CL3SourceError('Offset pagination requires pageSize')
        }

        const offsetParam = pagination.offsetParam ?? 'offset'
        const limitParam = pagination.limitParam ?? 'limit'
        const allItems: unknown[] = []
        let offset = 0

        while (true) {
          const signal = AbortSignal.timeout(timeout)
          const url = buildUrl(endpoint, {
            [offsetParam]: offset,
            [limitParam]: pageSize,
          })

          const response = await fetch(url, {
            headers,
            signal,
          })

          if (!response.ok) {
            throw new CL3SourceError(
              `Remote source fetch failed: HTTP ${response.status}`,
              response.status
            )
          }

          const raw = await response.json()
          const pageItems = transform ? transform(raw) : (Array.isArray(raw) ? raw : [])

          allItems.push(...pageItems)

          if (pageItems.length < pageSize) {
            break
          }

          offset += pageSize
        }

        return allItems
      }

      if (pagination.strategy === 'cursor') {
        const cursorParam = pagination.cursorParam ?? 'cursor'
        const cursorResponseKey = pagination.cursorResponseKey ?? 'nextCursor'
        const allItems: unknown[] = []
        let cursor: string | undefined

        while (true) {
          const signal = AbortSignal.timeout(timeout)
          const params: Record<string, string> = {}
          if (cursor) {
            params[cursorParam] = cursor
          }
          const url = cursor ? buildUrl(endpoint, params) : endpoint

          const response = await fetch(url, {
            headers,
            signal,
          })

          if (!response.ok) {
            throw new CL3SourceError(
              `Remote source fetch failed: HTTP ${response.status}`,
              response.status
            )
          }

          const raw = await response.json()
          const pageItems = transform ? transform(raw) : (Array.isArray(raw) ? raw : [])

          allItems.push(...pageItems)

          const nextCursor = (raw as Record<string, unknown>)?.[cursorResponseKey] as string | undefined

          if (!nextCursor) {
            break
          }

          cursor = nextCursor
        }

        return allItems
      }

      throw new CL3SourceError('Invalid pagination strategy')
    },
  }
}
