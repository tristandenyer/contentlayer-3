import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createPostmanClient,
  listCollections,
  getCollection,
  createCollection,
} from '../src/lib/postman-api.js'
import { CL3PostmanAPIError } from '../src/lib/errors.js'

const client = createPostmanClient({ apiKey: 'test-key', workspaceId: 'ws-1' })

function mockOk(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response
}

function mockError(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({ error: { message: 'Not found' } }),
  } as unknown as Response
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('listCollections', () => {
  it('calls correct endpoint with API key header', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockOk({ collections: [{ id: 'c1', name: 'Test', uid: 'u1', updatedAt: '' }] }))
    vi.stubGlobal('fetch', mockFetch)

    await listCollections(client)

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/collections')
    expect(url).toContain('workspace=ws-1')
    expect((options.headers as Record<string, string>)['x-api-key']).toBe('test-key')
  })

  it('returns array of collections', async () => {
    const collections = [
      { id: 'c1', name: 'A', uid: 'u1', updatedAt: '2024-01-01' },
      { id: 'c2', name: 'B', uid: 'u2', updatedAt: '2024-01-02' },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockOk({ collections })))

    const result = await listCollections(client)
    expect(result).toEqual(collections)
  })
})

describe('getCollection', () => {
  it('fetches collection by ID', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockOk({ collection: { id: 'c1', name: 'Test', collection: { item: [], variable: [] } } }))
    vi.stubGlobal('fetch', mockFetch)

    await getCollection(client, 'c1')

    const [url] = mockFetch.mock.calls[0] as [string]
    expect(url).toContain('/collections/c1')
  })
})

describe('createCollection', () => {
  it('POSTs with correct body', async () => {
    const mockFetch = vi.fn().mockResolvedValue(mockOk({ collection: { id: 'new-col' } }))
    vi.stubGlobal('fetch', mockFetch)

    const result = await createCollection(client, 'My API', JSON.stringify({ openapi: '3.1.0' }))

    expect(result).toEqual({ id: 'new-col' })
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/collections')
    expect(options.method).toBe('POST')
    const body = JSON.parse(options.body as string)
    expect(body.collection.info.name).toBe('My API')
  })
})

describe('error handling', () => {
  it('non-2xx response throws CL3PostmanAPIError with status code', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockError(404)))

    await expect(listCollections(client)).rejects.toThrow(CL3PostmanAPIError)
    await expect(listCollections(client)).rejects.toMatchObject({ status: 404 })
  })

  it('network error is wrapped in CL3PostmanAPIError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(listCollections(client)).rejects.toThrow()
  })
})
