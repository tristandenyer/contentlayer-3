import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { defineCollection, getCollectionBase } from '../src/index.js'
import { z } from 'zod'

describe('edge compatibility', () => {
  it('contentlayer3 core dist has no Node.js API references', () => {
    // Only run if dist exists
    let src: string
    try {
      src = readFileSync(new URL('../dist/index.js', import.meta.url), 'utf-8')
    } catch {
      // Skip if not built
      return
    }
    const nodeAPIs = ['node:fs', 'node:path', 'node:crypto', 'node:stream']
    for (const api of nodeAPIs) {
      expect(src).not.toContain(api)
    }
  })
})

describe('select field projection', () => {
  const schema = z.object({
    title: z.string(),
    slug: z.string(),
    body: z.string(),
  })

  const items = [
    { title: 'Hello', slug: 'hello', body: 'World' },
    { title: 'Foo', slug: 'foo', body: 'Bar' },
  ]

  it('select returns only selected fields', async () => {
    const col = defineCollection({
      name: `select-test-${Date.now()}`,
      source: { load: async () => items },
      schema,
    })
    const result = await getCollectionBase(col, { select: ['title', 'slug'] })
    expect(result[0]).toHaveProperty('title')
    expect(result[0]).toHaveProperty('slug')
    expect(result[0]).not.toHaveProperty('body')
  })

  it('select with nonexistent field does not crash', async () => {
    const col = defineCollection({
      name: `select-nonexist-${Date.now()}`,
      source: { load: async () => items },
      schema,
    })
    await expect(
      getCollectionBase(col, { select: ['title', 'nonexistent' as any] })
    ).resolves.toBeDefined()
  })

  it('select always includes _filePath when present', async () => {
    const schemaWithPath = z.object({ title: z.string(), _filePath: z.string() })
    const col = defineCollection({
      name: `select-filepath-${Date.now()}`,
      source: { load: async () => [{ title: 'A', _filePath: '/posts/a.md' }] },
      schema: schemaWithPath,
    })
    const result = await getCollectionBase(col, { select: ['title'] })
    expect(result[0]).toHaveProperty('_filePath')
  })
})
