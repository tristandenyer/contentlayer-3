import { z } from 'zod'
import type { Collection } from './types.js'
import { getCollectionBase } from './get-collection.js'

/**
 * Defines a reference field to another collection. Returns a Zod string schema
 * (stores the referenced item's identifier at rest) with a branded description
 * so tooling can identify it as a reference.
 *
 * Example:
 *   schema: z.object({
 *     title: z.string(),
 *     author: reference(authors),   // stored as string ID / slug
 *   })
 */
export function reference<TSchema extends z.ZodObject<z.ZodRawShape>>(
  _collection: Collection<TSchema>
): z.ZodString {
  return z.string().describe(`ref:${_collection.name}`)
}

/**
 * Resolves a single reference ID to the matching item in the target collection.
 * Looks up by `_filePath`, `slug`, or `id` field (first match wins).
 * Returns undefined if no item matches.
 *
 * Example:
 *   const post = await getCollectionBase(posts)
 *   const author = await resolveReference(authors, post.author)
 */
export async function resolveReference<TSchema extends z.ZodObject<z.ZodRawShape>>(
  collection: Collection<TSchema>,
  id: string
): Promise<z.infer<TSchema> | undefined> {
  const items = await getCollectionBase(collection) as z.infer<TSchema>[]
  return items.find((item) => {
    const r = item as Record<string, unknown>
    return r['_filePath'] === id || r['slug'] === id || r['id'] === id
  })
}

/**
 * Resolves multiple reference IDs to their matching items in the target collection.
 * Items that cannot be resolved are omitted from the result.
 *
 * Example:
 *   const post = await getCollectionBase(posts)
 *   const tags = await resolveReferences(tagCollection, post.tags)
 */
export async function resolveReferences<TSchema extends z.ZodObject<z.ZodRawShape>>(
  collection: Collection<TSchema>,
  ids: string[]
): Promise<z.infer<TSchema>[]> {
  const items = await getCollectionBase(collection) as z.infer<TSchema>[]
  const idSet = new Set(ids)
  return items.filter((item) => {
    const r = item as Record<string, unknown>
    return idSet.has(r['_filePath'] as string)
      || idSet.has(r['slug'] as string)
      || idSet.has(r['id'] as string)
  })
}
