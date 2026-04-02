export { buildGraphQLSchema } from './lib/schema-builder.js'
export { createRouteHandler, executeGraphQL } from './lib/handler.js'
export { printSDL, writeSDL } from './lib/sdl.js'
export { zodTypeToGraphQL, zodObjectToGraphQLType, JSONScalar } from './lib/zod-to-graphql.js'
export { CL3GraphQLError, CL3GraphQLSchemaError, CL3GraphQLResolverError } from './lib/errors.js'
export type { CollectionDefinition } from './lib/schema-builder.js'
export type { GraphQLRequestBody } from './lib/handler.js'

/**
 * Convenience wrapper: build a schema and route handler from a set of
 * collection definitions in one call.
 *
 * Usage in app/api/graphql/route.ts:
 *
 *   import { withCollections } from '@contentlayer3/graphql'
 *   import { getCollection } from 'contentlayer3'
 *   import { posts } from '../../../contentlayer3.config'
 *
 *   export const { GET, POST } = withCollections([
 *     { name: 'posts', schema: posts.schema, getItems: () => getCollection(posts) },
 *   ])
 */
export { withCollections } from './with-collections.js'
