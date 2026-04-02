import type { z } from 'zod'
import type { CollectionConfig, Collection } from './types.js'

export function defineCollection<TSchema extends z.ZodObject<z.ZodRawShape>>(
  config: CollectionConfig<TSchema>
): Collection<TSchema> {
  return {
    name: config.name,
    source: config.source,
    schema: config.schema,
    config,
  }
}
