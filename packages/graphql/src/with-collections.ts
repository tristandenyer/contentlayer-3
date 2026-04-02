import { buildGraphQLSchema } from './lib/schema-builder.js'
import { createRouteHandler } from './lib/handler.js'
import type { CollectionDefinition } from './lib/schema-builder.js'

/**
 * Build a GraphQL schema and Next.js route handler from collection definitions.
 *
 * @example
 * // app/api/graphql/route.ts
 * import { withCollections } from '@contentlayer3/graphql'
 * import { getCollection } from 'contentlayer3'
 * import { posts, authors } from '../../../contentlayer3.config'
 *
 * export const { GET, POST } = withCollections([
 *   { name: 'posts',   schema: posts.schema,   getItems: () => getCollection(posts) },
 *   { name: 'authors', schema: authors.schema, getItems: () => getCollection(authors) },
 * ])
 */
export function withCollections(collections: CollectionDefinition[]): {
  GET: (req: Request) => Promise<Response>
  POST: (req: Request) => Promise<Response>
} {
  const schema = buildGraphQLSchema(collections)
  return createRouteHandler(schema)
}
