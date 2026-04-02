import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLList,
  GraphQLString,
  GraphQLInt,
  GraphQLFieldConfigMap,
} from 'graphql'
import { z } from 'zod'
import { zodObjectToGraphQLType, clearTypeCache } from './zod-to-graphql.js'
import { CL3GraphQLSchemaError } from './errors.js'

export interface CollectionDefinition {
  name: string
  schema: z.ZodObject<z.ZodRawShape>
  getItems: () => Promise<unknown[]>
}

/**
 * Converts a collection name to a valid GraphQL type name.
 * e.g. "blog-posts" → "BlogPosts"
 */
function toTypeName(name: string): string {
  return name
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/**
 * Build a GraphQL schema from one or more contentlayer3 collection definitions.
 *
 * Each collection gets:
 *   - A named object type derived from its Zod schema
 *   - A root Query field `<collectionName>` returning a list
 *   - A root Query field `<collectionName>ById` accepting an `id: String!` arg
 *   - Pagination args: `limit` and `offset`
 */
export function buildGraphQLSchema(collections: CollectionDefinition[]): GraphQLSchema {
  if (collections.length === 0) {
    throw new CL3GraphQLSchemaError('At least one collection is required to build a GraphQL schema.')
  }

  clearTypeCache()

  const queryFields: GraphQLFieldConfigMap<unknown, unknown> = {}

  for (const collection of collections) {
    const typeName = toTypeName(collection.name)
    const itemType = zodObjectToGraphQLType(collection.schema, typeName)
    const listType = new GraphQLList(new GraphQLNonNull(itemType))

    // <collectionName>: [Type!] with pagination
    queryFields[collection.name] = {
      type: listType,
      description: `Fetch all items from the "${collection.name}" collection.`,
      args: {
        limit: { type: GraphQLInt, description: 'Maximum number of items to return.' },
        offset: { type: GraphQLInt, description: 'Number of items to skip.' },
      },
      resolve: async (_source: unknown, args: { limit?: number; offset?: number }) => {
        const items = await collection.getItems()
        const start = args.offset ?? 0
        const end = args.limit != null ? start + args.limit : undefined
        return items.slice(start, end)
      },
    }

    // <collectionName>ById: Type
    queryFields[`${collection.name}ById`] = {
      type: itemType,
      description: `Fetch a single item from the "${collection.name}" collection by its \`id\` field.`,
      args: {
        id: { type: new GraphQLNonNull(GraphQLString), description: 'The item id.' },
      },
      resolve: async (_source: unknown, args: { id: string }) => {
        const items = await collection.getItems() as Array<Record<string, unknown>>
        return items.find((item) => String(item['id']) === args.id) ?? null
      },
    }
  }

  const query = new GraphQLObjectType({ name: 'Query', fields: queryFields })
  return new GraphQLSchema({ query })
}
