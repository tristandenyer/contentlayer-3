import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

// Mock next/cache BEFORE importing anything that uses it
vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown, _keys: unknown[], _opts: unknown) => fn),
  revalidateTag: vi.fn(),
}))

import { getCollection, getCollectionItem, revalidateCollection, cl3Tags, defineCollection, filesystem } from '../src/index.js'

const tmpDir = join(process.cwd(), '.test-tmp-next')
const postsDir = join(tmpDir, 'posts')

beforeAll(() => {
  mkdirSync(postsDir, { recursive: true })
  writeFileSync(join(postsDir, 'hello.md'), '---\ntitle: "Hello"\ndate: "2024-01-01"\n---\n# Hello')
  writeFileSync(join(postsDir, 'world.md'), '---\ntitle: "World"\ndate: "2024-01-02"\n---\n# World')
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
    source: filesystem({ contentDir: postsDir, pattern: '**/*.md' }),
    schema: postSchema,
  })
}

describe('getCollection (Next.js adapter)', () => {
  it('returns validated items from filesystem source', async () => {
    const col = makeCollection('next-posts-1')
    const items = await getCollection(col)
    expect(items).toHaveLength(2)
    expect(items[0].title).toBeTypeOf('string')
    expect(items[0]._filePath).toBeTypeOf('string')
  })

  it('passes revalidate option through to unstable_cache', async () => {
    // @ts-expect-error next/cache is only available at runtime in Next.js projects
    const { unstable_cache } = await import('next/cache')
    const col = makeCollection('next-posts-2')
    await getCollection(col, { revalidate: 120 })
    expect(unstable_cache).toHaveBeenCalledWith(
      expect.any(Function),
      ['cl3', 'next-posts-2'],
      expect.objectContaining({ revalidate: 120, tags: ['cl3:all', 'cl3:next-posts-2'] })
    )
  })
})

describe('getCollectionItem (Next.js adapter)', () => {
  it('returns correct item by predicate', async () => {
    const col = makeCollection('next-item-1')
    const item = await getCollectionItem(col, (p) => p.title === 'Hello')
    expect(item).toBeDefined()
    expect(item?.title).toBe('Hello')
  })
})

describe('revalidateCollection', () => {
  it('calls revalidateTag with correct tag', async () => {
    // @ts-expect-error next/cache is only available at runtime in Next.js projects
    const { revalidateTag } = await import('next/cache')
    revalidateCollection('posts')
    expect(revalidateTag).toHaveBeenCalledWith('cl3:posts')
  })
})

describe('cl3Tags', () => {
  it('returns correct tag strings', () => {
    const tags = cl3Tags('posts')
    expect(tags.tag).toBe('cl3:posts')
    expect(tags.allTag).toBe('cl3:all')
  })

  it('uses collection name in tag', () => {
    const tags = cl3Tags('articles')
    expect(tags.tag).toBe('cl3:articles')
  })
})
