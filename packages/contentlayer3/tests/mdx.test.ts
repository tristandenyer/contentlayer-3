import { describe, it, expect } from 'vitest'
import { compileMDX, withMDX } from '../src/index.js'

const simpleMDX = '# Hello\n\nThis is **bold** text with some words.'
const withHeadings = '# Main Title\n\n## Sub Heading\n\n### Deep Heading\n\nContent here with enough words to have a reading time.'
const withComponents = '# Title\n\n<CustomComponent />\n\nMore content goes here.'
const emptyContent = ''
const manyWords = Array(300).fill('word').join(' ')

describe('compileMDX', () => {
  it('returns a non-empty code string', async () => {
    const result = await compileMDX(simpleMDX)
    expect(result.code).toBeTypeOf('string')
    expect(result.code.length).toBeGreaterThan(0)
  })

  it('extracts TOC from headings with correct depth, text, slug', async () => {
    const result = await compileMDX(withHeadings)
    expect(result.toc).toHaveLength(3)
    expect(result.toc[0]).toEqual({ depth: 1, text: 'Main Title', slug: 'main-title' })
    expect(result.toc[1]).toEqual({ depth: 2, text: 'Sub Heading', slug: 'sub-heading' })
    expect(result.toc[2]).toEqual({ depth: 3, text: 'Deep Heading', slug: 'deep-heading' })
  })

  it('computes readingTime > 0 for non-empty content', async () => {
    const result = await compileMDX(manyWords)
    expect(result.readingTime).toBeGreaterThan(0)
  })

  it('empty content returns empty toc and readingTime of 0', async () => {
    const result = await compileMDX(emptyContent)
    expect(result.toc).toHaveLength(0)
    expect(result.readingTime).toBe(0)
  })

  it('nested headings produce correct TocEntry depth values', async () => {
    const md = '# H1\n\n## H2\n\n#### H4'
    const result = await compileMDX(md)
    expect(result.toc.map((e) => e.depth)).toEqual([1, 2, 4])
  })

  it('compiles MDX with custom component without throwing', async () => {
    const result = await compileMDX(withComponents)
    expect(result.code).toBeTypeOf('string')
    expect(result.code.length).toBeGreaterThan(0)
  })

  it('processes GFM tables when remark-gfm is provided', async () => {
    const { default: remarkGfm } = await import('remark-gfm')
    const tableContent = '| Col1 | Col2 |\n|------|------|\n| A    | B    |'
    const result = await compileMDX(tableContent, { remarkPlugins: [remarkGfm] })
    expect(result.code).toContain('table')
  })
})

describe('withMDX', () => {
  it('adds mdx field to item', async () => {
    const item = { _content: simpleMDX, _filePath: 'test.mdx', title: 'Test' }
    const transform = withMDX()
    const result = await transform(item)
    expect(result.mdx).toBeDefined()
    expect(result.mdx.code).toBeTypeOf('string')
    expect(Array.isArray(result.mdx.toc)).toBe(true)
  })

  it('preserves all original item fields', async () => {
    const item = { _content: simpleMDX, _filePath: 'posts/test.mdx', title: 'My Post', date: '2024-01-01' }
    const transform = withMDX()
    const result = await transform(item)
    expect(result._filePath).toBe('posts/test.mdx')
    expect(result.title).toBe('My Post')
    expect(result.date).toBe('2024-01-01')
    expect(result._content).toBe(simpleMDX)
  })
})
