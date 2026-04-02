import type { z } from 'zod'

export interface CollectionSource<T> {
  load(): Promise<T[]>
  watch?(onChange: () => void): () => void
}

export interface CollectionConfig<TSchema extends z.ZodType> {
  name: string
  source: CollectionSource<unknown>
  schema: TSchema
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
