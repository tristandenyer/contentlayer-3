import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { defineCollection, getCollection, getCollectionItem, CL3ValidationError } from '../src/index.js'
import { filesystem } from '../../source-filesystem/src/index.js'

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

describe('getCollection', () => {
  it('returns typed array from filesystem source', async () => {
    const col = makeCollection('posts-load')
    const items = await getCollection(col)
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

    await expect(getCollection(col)).rejects.toThrow(CL3ValidationError)
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
      await getCollection(col)
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
    const first = await getCollection(col)
    const second = await getCollection(col)
    expect(first).toBe(second)
  })

  it('{ fresh: true } bypasses cache and re-reads', async () => {
    const col = makeCollection('posts-fresh')
    const first = await getCollection(col)
    const second = await getCollection(col, { fresh: true })
    expect(first).not.toBe(second)
    expect(first).toEqual(second)
  })

  it('_filePath is present on every returned item', async () => {
    const col = makeCollection('posts-filepath')
    const items = await getCollection(col)
    for (const item of items) {
      expect(item._filePath).toBeTypeOf('string')
      expect(item._filePath.length).toBeGreaterThan(0)
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
      await getCollection(col)
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(CL3ValidationError)
      const e = err as CL3ValidationError
      expect(e.fieldPath).toBe('date')
    }
  })
})

describe('getCollectionItem', () => {
  it('returns correct item by predicate', async () => {
    const col = makeCollection('posts-item')
    const item = await getCollectionItem(col, (p) => p.title === 'Hello')
    expect(item).toBeDefined()
    expect(item?.title).toBe('Hello')
  })

  it('returns undefined if no match', async () => {
    const col = makeCollection('posts-item-miss')
    const item = await getCollectionItem(col, (p) => p.title === 'Nonexistent')
    expect(item).toBeUndefined()
  })
})
