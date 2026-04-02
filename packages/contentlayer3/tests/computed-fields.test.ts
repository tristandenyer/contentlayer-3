import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { defineCollection, getCollectionBase } from '../src/index.js'
import { reference, resolveReference, resolveReferences } from '../src/index.js'

function makeSource(items: unknown[]) {
  return { load: async () => items }
}

describe('computedFields', () => {
  it('adds a computed field to every item', async () => {
    const col = defineCollection({
      name: 'computed-basic',
      source: makeSource([
        { title: 'Hello World', _filePath: 'posts/hello-world.md' },
      ]),
      schema: z.object({ title: z.string(), _filePath: z.string() }),
      computedFields: {
        slug: (item) => item._filePath.replace(/\.mdx?$/, '').split('/').pop() ?? '',
      },
    })

    const items = await getCollectionBase(col) as Array<{ title: string; slug: string }>
    expect(items[0].slug).toBe('hello-world')
  })

  it('computed field can reference other base fields', async () => {
    const col = defineCollection({
      name: 'computed-url',
      source: makeSource([{ title: 'About', _filePath: 'pages/about.md' }]),
      schema: z.object({ title: z.string(), _filePath: z.string() }),
      computedFields: {
        slug: (item) => item._filePath.replace(/\.mdx?$/, '').split('/').pop() ?? '',
        url: (item) => `/pages/${(item._filePath.replace(/\.mdx?$/, '').split('/').pop() ?? '')}`,
      },
    })

    const items = await getCollectionBase(col) as Array<{ url: string }>
    expect(items[0].url).toBe('/pages/about')
  })

  it('async computed fields are awaited', async () => {
    const col = defineCollection({
      name: 'computed-async',
      source: makeSource([{ title: 'Post', _filePath: 'posts/post.md' }]),
      schema: z.object({ title: z.string(), _filePath: z.string() }),
      computedFields: {
        wordCount: async (_item) => {
          await Promise.resolve()
          return 42
        },
      },
    })

    const items = await getCollectionBase(col) as Array<{ wordCount: number }>
    expect(items[0].wordCount).toBe(42)
  })

  it('collections without computedFields work as before', async () => {
    const col = defineCollection({
      name: 'computed-none',
      source: makeSource([{ title: 'Plain', _filePath: 'plain.md' }]),
      schema: z.object({ title: z.string(), _filePath: z.string() }),
    })

    const items = await getCollectionBase(col)
    expect(items[0].title).toBe('Plain')
    expect((items[0] as Record<string, unknown>).slug).toBeUndefined()
  })

  it('computed fields appear on all items in a multi-item collection', async () => {
    const col = defineCollection({
      name: 'computed-multi',
      source: makeSource([
        { title: 'A', _filePath: 'a.md' },
        { title: 'B', _filePath: 'b.md' },
        { title: 'C', _filePath: 'c.md' },
      ]),
      schema: z.object({ title: z.string(), _filePath: z.string() }),
      computedFields: {
        slug: (item) => item._filePath.replace(/\.md$/, ''),
      },
    })

    const items = await getCollectionBase(col) as Array<{ slug: string }>
    expect(items.map((i) => i.slug)).toEqual(['a', 'b', 'c'])
  })
})

describe('reference() and resolveReference()', () => {
  const authorSchema = z.object({ name: z.string(), slug: z.string() })
  const authorSource = makeSource([
    { name: 'Alice', slug: 'alice' },
    { name: 'Bob', slug: 'bob' },
  ])

  function makeAuthors() {
    return defineCollection({
      name: 'ref-authors',
      source: authorSource,
      schema: authorSchema,
    })
  }

  it('reference() returns a z.ZodString with ref description', () => {
    const authors = makeAuthors()
    const field = reference(authors)
    expect(field instanceof z.ZodString).toBe(true)
    expect(field.description).toBe('ref:ref-authors')
  })

  it('resolveReference finds item by slug', async () => {
    const authors = makeAuthors()
    const author = await resolveReference(authors, 'alice')
    expect(author).toBeDefined()
    expect(author?.name).toBe('Alice')
  })

  it('resolveReference returns undefined for unknown id', async () => {
    const authors = makeAuthors()
    const author = await resolveReference(authors, 'nobody')
    expect(author).toBeUndefined()
  })

  it('resolveReference finds item by _filePath', async () => {
    const col = defineCollection({
      name: 'ref-by-filepath',
      source: makeSource([{ name: 'Carol', _filePath: 'authors/carol.md', slug: 'carol' }]),
      schema: z.object({ name: z.string(), _filePath: z.string(), slug: z.string() }),
    })
    const item = await resolveReference(col, 'authors/carol.md')
    expect(item?.name).toBe('Carol')
  })

  it('resolveReferences returns matching items', async () => {
    const authors = makeAuthors()
    const resolved = await resolveReferences(authors, ['alice', 'bob'])
    expect(resolved).toHaveLength(2)
    expect(resolved.map((a) => a.name).sort()).toEqual(['Alice', 'Bob'])
  })

  it('resolveReferences omits unknown ids', async () => {
    const authors = makeAuthors()
    const resolved = await resolveReferences(authors, ['alice', 'unknown'])
    expect(resolved).toHaveLength(1)
    expect(resolved[0].name).toBe('Alice')
  })

  it('reference field works inside defineCollection schema', async () => {
    const authors = makeAuthors()
    const posts = defineCollection({
      name: 'ref-posts',
      source: makeSource([{ title: 'My Post', author: 'alice', _filePath: 'post.md' }]),
      schema: z.object({
        title: z.string(),
        author: reference(authors),
        _filePath: z.string(),
      }),
    })

    const items = await getCollectionBase(posts)
    expect(items[0].author).toBe('alice')

    const resolved = await resolveReference(authors, items[0].author as string)
    expect(resolved?.name).toBe('Alice')
  })
})
