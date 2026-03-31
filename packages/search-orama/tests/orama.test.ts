import { describe, it, expect } from 'vitest'
import { oramaIndexPlugin } from '../src/index.js'

const items = [
  { title: 'TypeScript Guide', excerpt: 'Learn TypeScript basics' },
  { title: 'React Patterns', excerpt: 'Advanced React component patterns' },
  { title: 'Node.js Streams', excerpt: 'Working with streams in Node.js' },
]

describe('oramaIndexPlugin', () => {
  it('onIndexReady populates the index with all items', async () => {
    const plugin = oramaIndexPlugin({ schema: { title: 'string', excerpt: 'string' } })
    await plugin.onIndexReady(items)
    const db = plugin.getDb()
    expect(db).not.toBeNull()
  })

  it('search returns matching results for relevant query', async () => {
    const plugin = oramaIndexPlugin({ schema: { title: 'string', excerpt: 'string' } })
    await plugin.onIndexReady(items)
    const results = await plugin.search('TypeScript')
    expect(results.hits.length).toBeGreaterThan(0)
  })

  it('search returns empty array for non-matching query', async () => {
    const plugin = oramaIndexPlugin({ schema: { title: 'string', excerpt: 'string' } })
    await plugin.onIndexReady(items)
    const results = await plugin.search('zzznomatch999xyz')
    expect(results.hits.length).toBe(0)
  })

  it('search before onIndexReady throws informative error', async () => {
    const plugin = oramaIndexPlugin({ schema: { title: 'string', excerpt: 'string' } })
    await expect(plugin.search('anything')).rejects.toThrow('Index not ready')
  })

  it('calling onIndexReady twice rebuilds the index not appends', async () => {
    const plugin = oramaIndexPlugin({ schema: { title: 'string', excerpt: 'string' } })
    await plugin.onIndexReady(items)
    await plugin.onIndexReady([{ title: 'Only This', excerpt: 'just one item' }])
    const results = await plugin.search('TypeScript')
    // Should not find items from first load
    expect(results.hits.length).toBe(0)
  })

  it('search with limit option limits results', async () => {
    const manyItems = Array.from({ length: 20 }, (_, i) => ({
      title: `TypeScript Item ${i}`,
      excerpt: `TypeScript excerpt ${i}`,
    }))
    const plugin = oramaIndexPlugin({ schema: { title: 'string', excerpt: 'string' } })
    await plugin.onIndexReady(manyItems)
    const results = await plugin.search('TypeScript', { limit: 3 })
    expect(results.hits.length).toBeLessThanOrEqual(3)
  })
})
