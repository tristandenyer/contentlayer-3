/**
 * Legacy compatibility test suite.
 *
 * Simulates a real-world Contentlayer v1/v2 blog project and asserts that
 * contentlayer3 produces the same output shape users depended on.
 *
 * Fixture layout mirrors what a typical user would have:
 *   content/posts/   — MDX blog posts with frontmatter
 *   content/authors/ — Markdown author profiles
 *   content/pages/   — Standalone MDX pages
 */

import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import { z } from 'zod'
import {
  defineCollection,
  getCollectionBase,
  getCollectionItemBase,
  reference,
  resolveReference,
  resolveReferences,
} from '../src/index.js'
import { filesystem } from '../src/index.js'
import { compileMDX, withMDX } from '../src/index.js'

const FIXTURE = join(import.meta.dirname, 'fixtures/legacy-blog')

// ─── Schema definitions (mirrors a real contentlayer.config.ts) ──────────────

const rawDataSchema = z.object({
  sourceFilePath: z.string(),
  sourceFileName: z.string(),
  sourceFileDir: z.string(),
  flattenedPath: z.string(),
  contentType: z.string(),
})

const bodySchema = z.object({ raw: z.string() })

const authorSchema = z.object({
  name: z.string(),
  slug: z.string(),
  bio: z.string(),
  twitter: z.string().optional(),
  avatar: z.string().optional(),
  _filePath: z.string(),
  _content: z.string(),
  body: bodySchema,
  _raw: rawDataSchema,
})

const postSchema = z.object({
  title: z.string(),
  date: z.string(),
  excerpt: z.string(),
  tags: z.array(z.string()),
  draft: z.boolean().default(false),
  author: z.string().optional(),   // reference stored as slug string
  _filePath: z.string(),
  _content: z.string(),
  body: bodySchema,
  _raw: rawDataSchema,
})

const pageSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  _filePath: z.string(),
  _content: z.string(),
  body: bodySchema,
  _raw: rawDataSchema,
})

function makeAuthors() {
  return defineCollection({
    name: 'authors',
    source: filesystem({ contentDir: join(FIXTURE, 'content/authors'), pattern: '**/*.md' }),
    schema: authorSchema,
    computedFields: {
      url: (a) => `/authors/${a.slug}`,
    },
  })
}

function makePosts() {
  const authors = makeAuthors()
  return defineCollection({
    name: 'posts',
    source: filesystem({ contentDir: join(FIXTURE, 'content/posts'), pattern: '**/*.mdx' }),
    schema: postSchema,
    computedFields: {
      slug:        (p) => p._filePath.replace(/\.mdx?$/, '').split('/').pop() ?? '',
      url:         (p) => `/posts/${p._filePath.replace(/\.mdx?$/, '').split('/').pop()}`,
      authorRef:   (_p) => reference(authors).description,  // sanity: ref field descriptor
    },
  })
}

function makePages() {
  return defineCollection({
    name: 'pages',
    source: filesystem({ contentDir: join(FIXTURE, 'content/pages'), pattern: '**/*.mdx' }),
    schema: pageSchema,
    computedFields: {
      slug: (p) => p._filePath.replace(/\.mdx?$/, '').split('/').pop() ?? '',
    },
  })
}

// ─── Basic loading ────────────────────────────────────────────────────────────

describe('Basic collection loading', () => {
  it('loads all posts from filesystem', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    expect(items.length).toBe(3)
  })

  it('loads all authors from filesystem', async () => {
    const authors = makeAuthors()
    const items = await getCollectionBase(authors)
    expect(items.length).toBe(2)
  })

  it('loads pages from filesystem', async () => {
    const pages = makePages()
    const items = await getCollectionBase(pages)
    expect(items.length).toBe(1)
  })
})

// ─── Frontmatter field shapes ─────────────────────────────────────────────────

describe('Frontmatter field shapes', () => {
  it('post has all expected frontmatter fields', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    const post = items.find((p) => (p as any).slug === 'hello-world') as any
    expect(post).toBeDefined()
    expect(post.title).toBe('Hello World')
    expect(post.date).toBe('2024-01-15')
    expect(post.excerpt).toBeTypeOf('string')
    expect(Array.isArray(post.tags)).toBe(true)
    expect(post.tags).toContain('intro')
    expect(post.draft).toBe(false)
  })

  it('post _filePath is a relative path string', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    for (const item of items) {
      expect((item as any)._filePath).toBeTypeOf('string')
      expect((item as any)._filePath.length).toBeGreaterThan(0)
      // Should be relative, not absolute
      expect((item as any)._filePath.startsWith('/')).toBe(false)
    }
  })

  it('post _content contains the markdown body (not frontmatter)', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    const post = items.find((p) => (p as any).slug === 'hello-world') as any
    expect(post._content).toContain('Welcome to my blog')
    expect(post._content).not.toContain('title:')
    expect(post._content).not.toContain('date:')
  })

  it('author has name, slug, bio fields', async () => {
    const authors = makeAuthors()
    const items = await getCollectionBase(authors)
    const alice = items.find((a) => (a as any).slug === 'alice') as any
    expect(alice).toBeDefined()
    expect(alice.name).toBe('Alice Nguyen')
    expect(alice.bio).toBeTypeOf('string')
    expect(alice.twitter).toBe('alicecodes')
  })

  it('optional frontmatter fields are undefined when absent', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    // hello-world has no author field
    const post = items.find((p) => (p as any).slug === 'hello-world') as any
    expect(post.author).toBeUndefined()
  })

  it('tags field is always an array', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    for (const item of items) {
      expect(Array.isArray((item as any).tags)).toBe(true)
    }
  })

  it('boolean default works — draft defaults to false', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    const post = items.find((p) => (p as any).slug === 'hello-world') as any
    expect(post.draft).toBe(false)
  })
})

// ─── Computed fields ──────────────────────────────────────────────────────────

describe('Computed fields (legacy computedFields pattern)', () => {
  it('slug is derived from _filePath', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    const slugs = items.map((p) => (p as any).slug).sort()
    expect(slugs).toEqual(['deep-dive-zod', 'draft-post', 'hello-world'])
  })

  it('url is derived from slug', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    const post = items.find((p) => (p as any).slug === 'hello-world') as any
    expect(post.url).toBe('/posts/hello-world')
  })

  it('author computed url is /authors/:slug', async () => {
    const authors = makeAuthors()
    const items = await getCollectionBase(authors)
    const alice = items.find((a) => (a as any).slug === 'alice') as any
    expect(alice.url).toBe('/authors/alice')
  })

  it('pages have slug computed from _filePath', async () => {
    const pages = makePages()
    const items = await getCollectionBase(pages)
    expect((items[0] as any).slug).toBe('about')
  })
})

// ─── Draft filtering (common legacy pattern) ──────────────────────────────────

describe('Draft filtering', () => {
  it('can filter out draft posts', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    const published = items.filter((p) => !(p as any).draft)
    expect(published.length).toBe(2)
    expect(published.every((p) => !(p as any).draft)).toBe(true)
  })

  it('draft post is present in full collection (filtering is user responsibility)', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    const draft = items.find((p) => (p as any).slug === 'draft-post') as any
    expect(draft).toBeDefined()
    expect(draft.draft).toBe(true)
  })
})

// ─── Collection references ────────────────────────────────────────────────────

describe('Collection references (legacy reference() pattern)', () => {
  it('resolveReference finds author by slug from post.author field', async () => {
    const authors = makeAuthors()
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    const post = items.find((p) => (p as any).slug === 'deep-dive-zod') as any
    expect(post.author).toBe('alice')

    const author = await resolveReference(authors, post.author)
    expect(author).toBeDefined()
    expect(author?.name).toBe('Alice Nguyen')
  })

  it('resolveReferences resolves an array of tag-like slugs', async () => {
    // Simulate tags-as-collection pattern
    const tagSchema = z.object({ name: z.string(), slug: z.string() })
    const tags = defineCollection({
      name: 'tags',
      source: {
        load: async () => [
          { name: 'TypeScript', slug: 'typescript' },
          { name: 'Zod', slug: 'zod' },
          { name: 'Validation', slug: 'validation' },
        ],
      },
      schema: tagSchema,
    })

    const resolved = await resolveReferences(tags, ['typescript', 'zod'])
    expect(resolved).toHaveLength(2)
    expect(resolved.map((t) => t.name).sort()).toEqual(['TypeScript', 'Zod'])
  })

  it('resolveReference returns undefined for posts without an author', async () => {
    const authors = makeAuthors()
    // hello-world has no author
    const result = await resolveReference(authors, undefined as unknown as string)
    expect(result).toBeUndefined()
  })
})

// ─── MDX body compilation ─────────────────────────────────────────────────────

describe('MDX body compilation (body.code / body.raw equivalent)', () => {
  it('compileMDX returns code string (equivalent to old body.code)', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    const post = items.find((p) => (p as any).slug === 'hello-world') as any

    const mdx = await compileMDX(post._content)
    // body.code equivalent — a compilable function body string
    expect(mdx.code).toBeTypeOf('string')
    expect(mdx.code.length).toBeGreaterThan(0)
    // Old contentlayer body.code started with the MDX function-body preamble
    expect(mdx.code).toContain('function')
  })

  it('compileMDX toc matches heading structure', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    const post = items.find((p) => (p as any).slug === 'hello-world') as any

    const mdx = await compileMDX(post._content)
    expect(Array.isArray(mdx.toc)).toBe(true)
    expect(mdx.toc.length).toBeGreaterThan(0)

    const h1 = mdx.toc.find((t) => t.depth === 1)
    expect(h1).toBeDefined()
    expect(h1?.text).toBe('Hello World')
    expect(h1?.slug).toBe('hello-world')

    const h2s = mdx.toc.filter((t) => t.depth === 2)
    expect(h2s.map((t) => t.text)).toContain('Getting Started')
    expect(h2s.map((t) => t.text)).toContain('Conclusion')
  })

  it('compileMDX readingTime is a positive number', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    const post = items.find((p) => (p as any).slug === 'deep-dive-zod') as any

    const mdx = await compileMDX(post._content)
    expect(mdx.readingTime).toBeTypeOf('number')
    expect(mdx.readingTime).toBeGreaterThan(0)
  })

  it('withMDX adds .mdx property with code, toc, readingTime', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    const post = items.find((p) => (p as any).slug === 'hello-world') as any

    const transform = withMDX()
    const enriched = await transform(post)

    expect(enriched.mdx).toBeDefined()
    expect(enriched.mdx.code).toBeTypeOf('string')
    expect(Array.isArray(enriched.mdx.toc)).toBe(true)
    expect(enriched.mdx.readingTime).toBeTypeOf('number')
  })

  it('_content is the raw body (body.raw equivalent)', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    const post = items.find((p) => (p as any).slug === 'hello-world') as any

    // Raw markdown/MDX body, no frontmatter
    expect(post._content).toContain('# Hello World')
    expect(post._content).toContain('Welcome to my blog')
    expect(post._content).toContain('```typescript')
  })
})

// ─── getCollectionItemBase (single-item lookup) ───────────────────────────────

describe('getCollectionItemBase', () => {
  it('finds post by slug via predicate', async () => {
    const posts = makePosts()
    const item = await getCollectionItemBase(posts, (p) => {
      const slug = (p._filePath as string).replace(/\.mdx?$/, '').split('/').pop()
      return slug === 'deep-dive-zod'
    })
    expect(item).toBeDefined()
    expect(item?.title).toBe('A Deep Dive into Zod')
  })

  it('returns undefined for missing slug', async () => {
    const posts = makePosts()
    const item = await getCollectionItemBase(posts, (p) => {
      const slug = (p._filePath as string).replace(/\.mdx?$/, '').split('/').pop()
      return slug === 'does-not-exist'
    })
    expect(item).toBeUndefined()
  })
})

// ─── _raw data contract (v1/v2 compatibility) ─────────────────────────────────
//
// Original Contentlayer injected a `_raw` object on every document with:
//   _raw.sourceFilePath  — relative path from contentDirPath (same as _filePath)
//   _raw.sourceFileName  — basename of the file  e.g. "hello-world.mdx"
//   _raw.sourceFileDir   — directory portion      e.g. "posts"
//   _raw.flattenedPath   — path without extension e.g. "posts/hello-world"
//   _raw.contentType     — "mdx" | "md" | "data"
//
// Many real configs use `doc._raw.flattenedPath` for URL generation.
// CL3 replicates this shape so existing code continues to work without changes.

describe('_raw data contract (v1/v2 compat)', () => {
  it('every post has a _raw object', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    for (const item of items) {
      expect((item as any)._raw).toBeDefined()
      expect(typeof (item as any)._raw).toBe('object')
    }
  })

  it('_raw.sourceFilePath matches _filePath', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    for (const item of items) {
      const p = item as any
      expect(p._raw.sourceFilePath).toBe(p._filePath)
    }
  })

  it('_raw.sourceFileName is the basename of the file', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    const post = items.find((p) => (p as any)._raw.flattenedPath?.endsWith('hello-world')) as any
    expect(post._raw.sourceFileName).toBe('hello-world.mdx')
  })

  it('_raw.sourceFileDir is the directory portion', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    for (const item of items) {
      // files live in content/posts/ — _raw.sourceFileDir should contain that segment
      expect((item as any)._raw.sourceFileDir).toBeTypeOf('string')
      expect((item as any)._raw.sourceFileDir.length).toBeGreaterThan(0)
    }
  })

  it('_raw.flattenedPath is the path without extension', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    const post = items.find((p) => (p as any)._raw?.flattenedPath?.endsWith('hello-world')) as any
    expect(post).toBeDefined()
    expect(post._raw.flattenedPath).not.toMatch(/\.mdx?$/)
  })

  it('_raw.flattenedPath can be used for URL generation (v1 pattern)', async () => {
    // Mirrors: computedFields: { url: { resolve: (doc) => `/${doc._raw.flattenedPath}` } }
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    for (const item of items) {
      const p = item as any
      const url = `/${p._raw.flattenedPath}`
      expect(url).toMatch(/^\//)
      expect(url).not.toMatch(/\.mdx?$/)
    }
  })

  it('_raw.contentType is "mdx" for .mdx files', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    for (const item of items) {
      expect((item as any)._raw.contentType).toBe('mdx')
    }
  })

  it('_raw.contentType is "md" for .md files', async () => {
    const authors = makeAuthors()
    const items = await getCollectionBase(authors)
    for (const item of items) {
      expect((item as any)._raw.contentType).toBe('md')
    }
  })
})

// ─── body shim (v1/v2 body.raw compatibility) ────────────────────────────────
//
// v1/v2 exposed content as `body.raw` (and `body.code` for MDX).
// CL3's canonical field is `_content`, but `body.raw` is injected automatically
// so existing renderers and search hooks continue to work without changes.

describe('body shim (v1/v2 body.raw compat)', () => {
  it('every document has a body object', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    for (const item of items) {
      expect((item as any).body).toBeDefined()
      expect(typeof (item as any).body).toBe('object')
    }
  })

  it('body.raw equals _content', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    for (const item of items) {
      const p = item as any
      expect(p.body.raw).toBe(p._content)
    }
  })

  it('body.raw contains the markdown body without frontmatter', async () => {
    const posts = makePosts()
    const items = await getCollectionBase(posts)
    const post = items.find((p) => (p as any).slug === 'hello-world') as any
    expect(post.body.raw).toContain('Welcome to my blog')
    expect(post.body.raw).not.toContain('title:')
  })

  it('body.raw works on .md files too (authors)', async () => {
    const authors = makeAuthors()
    const items = await getCollectionBase(authors)
    for (const item of items) {
      expect((item as any).body).toBeDefined()
      expect(typeof (item as any).body.raw).toBe('string')
    }
  })
})

// ─── Multi-format sources ─────────────────────────────────────────────────────

describe('Multi-format source loading', () => {
  it('loads .md files (authors) correctly alongside .mdx files (posts)', async () => {
    const authors = makeAuthors()
    const posts = makePosts()

    const [authorItems, postItems] = await Promise.all([
      getCollectionBase(authors),
      getCollectionBase(posts),
    ])

    expect(authorItems.length).toBeGreaterThan(0)
    expect(postItems.length).toBeGreaterThan(0)

    // Authors come from .md, posts from .mdx — both should have _content
    for (const a of authorItems) {
      expect((a as any)._filePath).toMatch(/\.md$/)
    }
    for (const p of postItems) {
      expect((p as any)._filePath).toMatch(/\.mdx$/)
    }
  })
})
