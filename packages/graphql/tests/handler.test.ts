import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'
import { buildGraphQLSchema } from '../src/lib/schema-builder.js'
import { createRouteHandler, executeGraphQL } from '../src/lib/handler.js'
import { clearTypeCache } from '../src/lib/zod-to-graphql.js'

beforeEach(() => clearTypeCache())

const schema = () =>
  buildGraphQLSchema([
    {
      name: 'items',
      schema: z.object({ id: z.string(), label: z.string() }),
      getItems: async () => [{ id: 'a', label: 'Alpha' }],
    },
  ])

describe('executeGraphQL', () => {
  it('returns data for a valid query', async () => {
    const result = await executeGraphQL(schema(), { query: '{ items { id label } }' })
    expect(result.errors).toBeUndefined()
    expect((result.data as Record<string, unknown[]>)['items']).toHaveLength(1)
  })

  it('returns errors for an invalid query', async () => {
    const result = await executeGraphQL(schema(), { query: '{ nonexistent }' })
    expect(result.errors).toBeDefined()
  })
})

describe('createRouteHandler', () => {
  it('handles POST requests', async () => {
    const { POST } = createRouteHandler(schema())
    const req = new Request('http://localhost/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ items { id } }' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data: Record<string, unknown[]> }
    expect(json.data['items']).toHaveLength(1)
  })

  it('handles GET requests with query param', async () => {
    const { GET } = createRouteHandler(schema())
    const req = new Request(
      'http://localhost/api/graphql?query=%7B%20items%20%7B%20id%20%7D%20%7D',
      { method: 'GET' }
    )
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = (await res.json()) as { data: Record<string, unknown[]> }
    expect(json.data['items']).toHaveLength(1)
  })

  it('returns 400 for GET without query param', async () => {
    const { GET } = createRouteHandler(schema())
    const req = new Request('http://localhost/api/graphql', { method: 'GET' })
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})
