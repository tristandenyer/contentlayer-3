// @ts-expect-error next/cache is only available at runtime in Next.js projects
import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import type { Collection } from '@cl3/core'
import { CL3ValidationError } from '@cl3/core'

export function createNextCache() {
  return {
    cachedGetCollection<TSchema extends z.ZodObject<z.ZodRawShape>>(
      collection: Collection<TSchema>,
      revalidate = 3600
    ): () => Promise<z.infer<TSchema>[]> {
      const tag = `cl3:${collection.name}`
      return unstable_cache(
        async () => {
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
        },
        ['cl3', collection.name],
        { tags: ['cl3:all', tag], revalidate }
      )
    },
  }
}
