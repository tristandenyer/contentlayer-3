import type { z } from 'zod'

export interface CollectionSource<T> {
  load(): Promise<T[]>
  watch?(onChange: () => void): () => void
}

/**
 * A record of computed field definitions. Each key is the output field name;
 * the value is a function that receives the validated item and returns the
 * computed value. The function may be async.
 *
 * Example:
 *   computedFields: {
 *     slug: (item) => item._filePath.replace(/\.mdx?$/, ''),
 *     url:  (item) => `/posts/${item.slug}`,   // ← can reference other computed fields
 *   }
 */
export type ComputedFields<TItem> = Record<
  string,
  (item: TItem) => unknown | Promise<unknown>
>

export interface CollectionConfig<TSchema extends z.ZodType> {
  name: string
  source: CollectionSource<unknown>
  schema: TSchema
  computedFields?: ComputedFields<z.infer<TSchema>>
  onIndexReady?: (items: z.infer<TSchema>[]) => Promise<void> | void
}

export interface Collection<TSchema extends z.ZodType> {
  name: string
  source: CollectionSource<unknown>
  schema: TSchema
  config: CollectionConfig<TSchema>
}

export interface CL3Cache {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T, ttl?: number): void
  invalidate(key: string): void
}
