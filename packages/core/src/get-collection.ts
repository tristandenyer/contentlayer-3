import type { z } from 'zod'
import type { Collection } from './types.js'
import { createMemoryCache } from './cache.js'
import { CL3ValidationError, CL3SourceError } from './errors.js'

const globalCache = createMemoryCache()

export async function getCollection<TSchema extends z.ZodObject<z.ZodRawShape>>(
  collection: Collection<TSchema>,
  options?: { fresh?: boolean; select?: (keyof z.infer<TSchema>)[] }
): Promise<Partial<z.infer<TSchema>>[]> {
  const cacheKey = `cl3:${collection.name}`

  if (!options?.fresh) {
    const cached = globalCache.get<z.infer<TSchema>[]>(cacheKey)
    if (cached !== undefined) {
      return applySelectProjection(cached, options?.select)
    }
  }

  let rawItems: unknown[]
  try {
    rawItems = await collection.source.load()
  } catch (err) {
    throw new CL3SourceError(collection.name, err instanceof Error ? err : new Error(String(err)))
  }

  const results: z.infer<TSchema>[] = []

  for (const raw of rawItems) {
    const parsed = collection.schema.safeParse(raw)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const fieldPath = issue?.path.join('.') ?? '(unknown)'
      const filePath = (raw as Record<string, unknown>)._filePath as string ?? '(unknown)'
      throw new CL3ValidationError(
        collection.name,
        filePath,
        fieldPath,
        issue?.message ?? 'Unknown error'
      )
    }
    results.push(parsed.data)
  }

  globalCache.set(cacheKey, results)

  if (collection.config?.onIndexReady) {
    await collection.config.onIndexReady(results)
  }

  return applySelectProjection(results, options?.select)
}

function applySelectProjection<T extends Record<string, unknown>>(
  items: T[],
  select?: (keyof T)[]
): Partial<T>[] {
  if (!select) {
    return items
  }

  return items.map(item => {
    const keys = new Set<keyof T>(select)
    if ('_filePath' in item) keys.add('_filePath' as keyof T)
    const entries = [...keys].filter(k => k in item).map(k => [k, item[k]])
    return Object.fromEntries(entries) as Partial<T>
  })
}

export async function getCollectionItem<TSchema extends z.ZodObject<z.ZodRawShape>>(
  collection: Collection<TSchema>,
  predicate: (item: z.infer<TSchema>) => boolean
): Promise<z.infer<TSchema> | undefined> {
  const items = await getCollection(collection)
  return items.find(predicate)
}
