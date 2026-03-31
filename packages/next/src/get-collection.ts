// @ts-expect-error next/cache is only available at runtime in Next.js projects
import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import type { Collection } from '@cl3/core'
import { CL3ValidationError } from '@cl3/core'

async function loadAndValidate<TSchema extends z.ZodObject<z.ZodRawShape>>(
  collection: Collection<TSchema>
): Promise<z.infer<TSchema>[]> {
  const rawItems = await collection.source.load()
  const results: z.infer<TSchema>[] = []
  for (const raw of rawItems) {
    const parsed = collection.schema.safeParse(raw)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      const fieldPath = issue?.path.join('.') ?? '(unknown)'
      const filePath = (raw as Record<string, unknown>)._filePath as string ?? '(unknown)'
      throw new CL3ValidationError(collection.name, filePath, fieldPath, issue?.message ?? 'Unknown error')
    }
    results.push(parsed.data)
  }
  return results
}

export async function getCollection<TSchema extends z.ZodObject<z.ZodRawShape>>(
  collection: Collection<TSchema>,
  options?: { revalidate?: number }
): Promise<z.infer<TSchema>[]> {
  const revalidate = options?.revalidate ?? 3600
  const tag = `cl3:${collection.name}`

  const cached = unstable_cache(
    () => loadAndValidate(collection),
    ['cl3', collection.name],
    { tags: ['cl3:all', tag], revalidate }
  ) as () => Promise<z.infer<TSchema>[]>

  return cached()
}

export async function getCollectionItem<TSchema extends z.ZodObject<z.ZodRawShape>>(
  collection: Collection<TSchema>,
  predicate: (item: z.infer<TSchema>) => boolean,
  options?: { revalidate?: number }
): Promise<z.infer<TSchema> | undefined> {
  const items = await getCollection(collection, options)
  return items.find(predicate)
}
