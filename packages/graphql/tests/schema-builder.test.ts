import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'
import { buildGraphQLSchema, type CollectionDefinition } from '../src/lib/schema-builder.js'
import { clearTypeCache } from '../src/lib/zod-to-graphql.js'
import { CL3GraphQLSchemaError } from '../src/lib/errors.js'
import { graphql } from 'graphql'

beforeEach(() => clearTypeCache())

const posts: CollectionDefinition = {
  name: 'posts',
  schema: z.object({
    id: z.string(),
    title: z.string(),
    published: z.boolean(),
  }),
  getItems: async () => [
    { id: '1', title: 'Hello', published: true },
    { id: '2', title: 'World', published: false },
  ],
}

describe('buildGraphQLSchema', () => {
  it('throws when no collections are provided', () => {
    expect(() => buildGraphQLSchema([])).toThrow(CL3GraphQLSchemaError)
  })

  it('builds a schema with a query field per collection', () => {
    const schema = buildGraphQLSchema([posts])
    const queryType = schema.getQueryType()
    expect(queryType).toBeDefined()
    expect(queryType!.getFields()['posts']).toBeDefined()
    expect(queryType!.getFields()['postsById']).toBeDefined()
  })

  it('resolves all items from a collection', async () => {
    const schema = buildGraphQLSchema([posts])
    const result = await graphql({ schema, source: '{ posts { id title } }' })
    expect(result.errors).toBeUndefined()
    expect((result.data as Record<string, unknown[]>)['posts']).toHaveLength(2)
  })

  it('supports limit and offset pagination', async () => {
    const schema = buildGraphQLSchema([posts])
    const result = await graphql({
      schema,
      source: '{ posts(limit: 1, offset: 1) { id } }',
    })
    expect(result.errors).toBeUndefined()
    const items = (result.data as Record<string, Array<{ id: string }>>)['posts']
    expect(items).toHaveLength(1)
    expect(items[0]!.id).toBe('2')
  })

  it('resolves a single item by id', async () => {
    const schema = buildGraphQLSchema([posts])
    const result = await graphql({
      schema,
      source: '{ postsById(id: "1") { title } }',
    })
    expect(result.errors).toBeUndefined()
    expect((result.data as Record<string, { title: string }>)['postsById']!.title).toBe('Hello')
  })

  it('returns null for unknown id', async () => {
    const schema = buildGraphQLSchema([posts])
    const result = await graphql({
      schema,
      source: '{ postsById(id: "999") { title } }',
    })
    expect(result.errors).toBeUndefined()
    expect((result.data as Record<string, unknown>)['postsById']).toBeNull()
  })

  it('handles multiple collections', () => {
    const authors: CollectionDefinition = {
      name: 'authors',
      schema: z.object({ id: z.string(), name: z.string() }),
      getItems: async () => [],
    }
    const schema = buildGraphQLSchema([posts, authors])
    const fields = schema.getQueryType()!.getFields()
    expect(fields['posts']).toBeDefined()
    expect(fields['authors']).toBeDefined()
  })
})
