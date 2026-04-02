import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { defineCollection, getCollectionBase, getCollectionItemBase, CL3ValidationError } from '../src/index.js'
import { filesystem } from '../src/index.js'

const tmpDir = join(process.cwd(), '.test-tmp-core')
const contentDir = join(tmpDir, 'content', 'posts')

beforeAll(() => {
  mkdirSync(contentDir, { recursive: true })
  writeFileSync(join(contentDir, 'hello.md'), '---\ntitle: "Hello"\ndate: "2024-01-01"\n---\n# Hello')
  writeFileSync(join(contentDir, 'world.md'), '---\ntitle: "World"\ndate: "2024-01-02"\n---\n# World')
})

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

const postSchema = z.object({
  title: z.string(),
  date: z.string(),
  _content: z.string(),
  _filePath: z.string(),
})

function makeCollection(name = 'posts') {
  return defineCollection({
    name,
    source: filesystem({ contentDir: join(tmpDir, 'content', 'posts'), pattern: '**/*.md' }),
    schema: postSchema,
  })
}

describe('defineCollection', () => {
  it('returns a Collection object with correct name', () => {
    const col = makeCollection()
    expect(col.name).toBe('posts')
    expect(col.source).toBeDefined()
    expect(col.schema).toBeDefined()
  })
})

describe('getCollectionBase', () => {
  it('returns typed array from filesystem source', async () => {
    const col = makeCollection('posts-load')
    const items = await getCollectionBase(col)
    expect(items).toHaveLength(2)
    expect(items[0].title).toBeTypeOf('string')
  })

  it('validates schema — invalid items throw CL3ValidationError', async () => {
    mkdirSync(join(tmpDir, 'invalid'), { recursive: true })
    writeFileSync(join(tmpDir, 'invalid', 'bad.md'), '---\ntitle: 123\ndate: "2024-01-01"\n---\n')

    const col = defineCollection({
      name: 'invalid-col',
      source: filesystem({ contentDir: join(tmpDir, 'invalid'), pattern: '**/*.md' }),
      schema: postSchema,
    })

    await expect(getCollectionBase(col)).rejects.toThrow(CL3ValidationError)
  })

  it('CL3ValidationError message contains file path and field name', async () => {
    mkdirSync(join(tmpDir, 'invalid2'), { recursive: true })
    writeFileSync(join(tmpDir, 'invalid2', 'bad.md'), '---\ntitle: 123\ndate: "2024-01-01"\n---\n')

    const col = defineCollection({
      name: 'invalid-col-2',
      source: filesystem({ contentDir: join(tmpDir, 'invalid2'), pattern: '**/*.md' }),
      schema: postSchema,
    })

    try {
      await getCollectionBase(col)
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(CL3ValidationError)
      const e = err as CL3ValidationError
      expect(e.message).toContain('bad.md')
      expect(e.fieldPath).toBe('title')
    }
  })

  it('result is cached — calling twice returns same reference', async () => {
    const col = makeCollection('posts-cache')
    const first = await getCollectionBase(col)
    const second = await getCollectionBase(col)
    expect(first).toBe(second)
  })

  it('{ fresh: true } bypasses cache and re-reads', async () => {
    const col = makeCollection('posts-fresh')
    const first = await getCollectionBase(col)
    const second = await getCollectionBase(col, { fresh: true })
    expect(first).not.toBe(second)
    expect(first).toEqual(second)
  })

  it('_filePath is present on every returned item', async () => {
    const col = makeCollection('posts-filepath')
    const items = await getCollectionBase(col)
    for (const item of items) {
      expect(item._filePath).toBeTypeOf('string')
      expect((item._filePath!).length).toBeGreaterThan(0)
    }
  })

  it('missing required field throws CL3ValidationError with correct fieldPath', async () => {
    mkdirSync(join(tmpDir, 'missing-field'), { recursive: true })
    writeFileSync(join(tmpDir, 'missing-field', 'no-date.md'), '---\ntitle: "No Date"\n---\n')

    const col = defineCollection({
      name: 'missing-field-col',
      source: filesystem({ contentDir: join(tmpDir, 'missing-field'), pattern: '**/*.md' }),
      schema: postSchema,
    })

    try {
      await getCollectionBase(col)
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(CL3ValidationError)
      const e = err as CL3ValidationError
      expect(e.fieldPath).toBe('date')
    }
  })
})

describe('getCollectionItemBase', () => {
  it('returns correct item by predicate', async () => {
    const col = makeCollection('posts-item')
    const item = await getCollectionItemBase(col, (p) => p.title === 'Hello')
    expect(item).toBeDefined()
    expect(item?.title).toBe('Hello')
  })

  it('returns undefined if no match', async () => {
    const col = makeCollection('posts-item-miss')
    const item = await getCollectionItemBase(col, (p) => p.title === 'Nonexistent')
    expect(item).toBeUndefined()
  })
})

describe('onIndexReady hook', () => {
  it('onIndexReady is called when collection is loaded cold', async () => {
    const called: unknown[] = []
    const col = defineCollection({
      name: 'hooktest',
      source: { load: async () => [{ title: 'A' }] },
      schema: z.object({ title: z.string() }),
      onIndexReady: async (items) => { called.push(...items) },
    })
    await getCollectionBase(col)
    expect(called.length).toBe(1)
  })

  it('onIndexReady is NOT called on cache hit', async () => {
    let callCount = 0
    const col = defineCollection({
      name: 'hookcache',
      source: { load: async () => [{ title: 'B' }] },
      schema: z.object({ title: z.string() }),
      onIndexReady: async () => { callCount++ },
    })
    await getCollectionBase(col)   // cold load
    await getCollectionBase(col)   // cache hit
    expect(callCount).toBe(1)
  })

  it('onIndexReady receives the full validated array', async () => {
    let received: unknown[] = []
    const col = defineCollection({
      name: 'hookreceive',
      source: { load: async () => [{ title: 'X' }, { title: 'Y' }] },
      schema: z.object({ title: z.string() }),
      onIndexReady: async (items) => { received = items },
    })
    await getCollectionBase(col)
    expect(received).toEqual([{ title: 'X' }, { title: 'Y' }])
  })
})
