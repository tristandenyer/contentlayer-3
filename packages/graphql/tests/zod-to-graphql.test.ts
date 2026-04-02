import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'
import {
  zodTypeToGraphQL,
  zodObjectToGraphQLType,
  clearTypeCache,
  JSONScalar,
} from '../src/lib/zod-to-graphql.js'
import {
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLList,
  GraphQLNonNull,
  GraphQLEnumType,
  GraphQLObjectType,
} from 'graphql'

beforeEach(() => clearTypeCache())

describe('zodTypeToGraphQL', () => {
  it('maps z.string() to GraphQLString', () => {
    expect(zodTypeToGraphQL(z.string(), 'Test')).toBe(GraphQLString)
  })

  it('maps z.boolean() to GraphQLBoolean', () => {
    expect(zodTypeToGraphQL(z.boolean(), 'Test')).toBe(GraphQLBoolean)
  })

  it('maps z.number() to GraphQLFloat by default', () => {
    expect(zodTypeToGraphQL(z.number(), 'Test')).toBe(GraphQLFloat)
  })

  it('maps z.number().int() to GraphQLInt', () => {
    expect(zodTypeToGraphQL(z.number().int(), 'Test')).toBe(GraphQLInt)
  })

  it('maps z.array(z.string()) to [String!]', () => {
    const result = zodTypeToGraphQL(z.array(z.string()), 'Test')
    expect(result).toBeInstanceOf(GraphQLList)
    const inner = (result as GraphQLList<GraphQLNonNull<typeof GraphQLString>>).ofType
    expect(inner).toBeInstanceOf(GraphQLNonNull)
    expect((inner as GraphQLNonNull<typeof GraphQLString>).ofType).toBe(GraphQLString)
  })

  it('unwraps z.optional()', () => {
    expect(zodTypeToGraphQL(z.string().optional(), 'Test')).toBe(GraphQLString)
  })

  it('unwraps z.nullable()', () => {
    expect(zodTypeToGraphQL(z.string().nullable(), 'Test')).toBe(GraphQLString)
  })

  it('maps z.enum() to GraphQLEnumType', () => {
    const result = zodTypeToGraphQL(z.enum(['draft', 'published']), 'Status')
    expect(result).toBeInstanceOf(GraphQLEnumType)
    expect((result as GraphQLEnumType).name).toBe('StatusEnum')
  })

  it('falls back to JSONScalar for z.record()', () => {
    expect(zodTypeToGraphQL(z.record(z.string()), 'Test')).toBe(JSONScalar)
  })
})

describe('zodObjectToGraphQLType', () => {
  it('converts a ZodObject to a GraphQLObjectType', () => {
    const schema = z.object({ title: z.string(), count: z.number().int() })
    const result = zodObjectToGraphQLType(schema, 'Post')
    expect(result).toBeInstanceOf(GraphQLObjectType)
    expect(result.name).toBe('Post')
    const fields = result.getFields()
    expect(fields['title']).toBeDefined()
    expect(fields['count']).toBeDefined()
  })

  it('wraps non-optional fields in GraphQLNonNull', () => {
    const schema = z.object({ title: z.string() })
    const result = zodObjectToGraphQLType(schema, 'Post')
    const fields = result.getFields()
    expect(fields['title']!.type).toBeInstanceOf(GraphQLNonNull)
  })

  it('does not wrap optional fields in GraphQLNonNull', () => {
    const schema = z.object({ subtitle: z.string().optional() })
    const result = zodObjectToGraphQLType(schema, 'Post')
    const fields = result.getFields()
    expect(fields['subtitle']!.type).toBe(GraphQLString)
  })

  it('caches types by name', () => {
    const schema = z.object({ id: z.string() })
    const first = zodObjectToGraphQLType(schema, 'Cached')
    const second = zodObjectToGraphQLType(schema, 'Cached')
    expect(first).toBe(second)
  })
})
