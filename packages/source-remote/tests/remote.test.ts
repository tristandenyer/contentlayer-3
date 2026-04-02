import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { remote, CL3SourceError, type RemoteSourceOptions } from '../src/index.js'
import type { CollectionSource } from 'contentlayer3'

describe('source-remote', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('load() fetches endpoint and returns array of items (simple array response)', async () => {
    const items = [{ id: 1 }, { id: 2 }]
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => items,
    })

    const source = remote({ endpoint: 'https://api.example.com/items' })
    const result = await source.load()

    expect(result).toEqual(items)
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/items', {
      headers: undefined,
      signal: expect.any(AbortSignal),
    })
  })

  it('transform function extracts nested array from response', async () => {
    const raw = { data: [{ id: 1 }, { id: 2 }] }
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => raw,
    })

    const source = remote({
      endpoint: 'https://api.example.com/items',
      transform: (data: unknown) => {
        return (data as { data: unknown[] }).data
      },
    })
    const result = await source.load()

    expect(result).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('Non-2xx response throws CL3SourceError with status code', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
    })

    const source = remote({ endpoint: 'https://api.example.com/items' })

    try {
      await source.load()
      expect.fail('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(CL3SourceError)
      expect((error as CL3SourceError).statusCode).toBe(404)
      expect((error as CL3SourceError).message).toContain('HTTP 404')
    }
  })

  it('AbortSignal.timeout is called', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout')
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    const source = remote({ endpoint: 'https://api.example.com/items', timeout: 5000 })
    await source.load()

    expect(timeoutSpy).toHaveBeenCalledWith(5000)
    timeoutSpy.mockRestore()
  })

  it('AbortSignal.timeout uses default timeout of 10000', async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, 'timeout')
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    const source = remote({ endpoint: 'https://api.example.com/items' })
    await source.load()

    expect(timeoutSpy).toHaveBeenCalledWith(10000)
    timeoutSpy.mockRestore()
  })

  it('offset pagination: makes multiple requests until page returns fewer than pageSize items', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1 }, { id: 2 }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 3 }, { id: 4 }],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 5 }],
      })

    const source = remote({
      endpoint: 'https://api.example.com/items',
      pagination: {
        strategy: 'offset',
        pageSize: 2,
        offsetParam: 'offset',
        limitParam: 'limit',
      },
    })
    const result = await source.load()

    expect(result).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('cursor pagination: follows nextCursor until undefined', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: 1 }, { id: 2 }],
          nextCursor: 'cursor2',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: 3 }, { id: 4 }],
          nextCursor: 'cursor3',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [{ id: 5 }],
        }),
      })

    const source = remote({
      endpoint: 'https://api.example.com/items',
      pagination: {
        strategy: 'cursor',
        cursorParam: 'cursor',
        cursorResponseKey: 'nextCursor',
      },
      transform: (data: unknown) => {
        return (data as { items: unknown[] }).items
      },
    })
    const result = await source.load()

    expect(result).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('headers are included in fetch calls', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    const customHeaders = { Authorization: 'Bearer token123' }
    const source = remote({
      endpoint: 'https://api.example.com/items',
      headers: customHeaders,
    })
    await source.load()

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/items',
      expect.objectContaining({
        headers: customHeaders,
      })
    )
  })

  it('no node:fs or require( in source files', async () => {
    // Read the source file
    const fs = await import('fs').then((m) => m.promises)
    const sourceContent = await fs.readFile(
      new URL('../src/index.ts', import.meta.url),
      'utf-8'
    )

    expect(sourceContent).not.toContain('node:fs')
    expect(sourceContent).not.toContain("require('")
    expect(sourceContent).not.toContain('require("')
  })

  it('empty array response returns empty array', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })

    const source = remote({ endpoint: 'https://api.example.com/items' })
    const result = await source.load()

    expect(result).toEqual([])
  })

  it('returns CollectionSource interface', () => {
    const source = remote({ endpoint: 'https://api.example.com/items' })

    expect(source).toBeDefined()
    expect(typeof source.load).toBe('function')
    expect(source.watch).toBeUndefined()
  })

  it('offset pagination with no pageSize throws CL3SourceError', async () => {
    const source = remote({
      endpoint: 'https://api.example.com/items',
      pagination: {
        strategy: 'offset',
      },
    })
    await expect(source.load()).rejects.toThrow('Offset pagination requires pageSize')
  })

  it('cursor pagination with custom cursorResponseKey', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 1 }],
          paginationToken: 'token2',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 2 }],
        }),
      })

    const source = remote({
      endpoint: 'https://api.example.com/items',
      pagination: {
        strategy: 'cursor',
        cursorResponseKey: 'paginationToken',
      },
      transform: (data: unknown) => {
        return (data as { data: unknown[] }).data
      },
    })
    const result = await source.load()

    expect(result).toEqual([{ id: 1 }, { id: 2 }])
  })

  it('pagination strategy none is same as no pagination', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 1 }],
    })

    const source = remote({
      endpoint: 'https://api.example.com/items',
      pagination: {
        strategy: 'none',
      },
    })
    const result = await source.load()

    expect(result).toEqual([{ id: 1 }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
