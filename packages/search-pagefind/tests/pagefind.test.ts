import { describe, it, expect } from 'vitest'
import { pagefindPlugin } from '../src/index.js'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const items = [
  { title: 'Hello World', body: 'Content here', _filePath: '/posts/hello' },
  { title: 'Second Post', body: 'More content', _filePath: '/posts/second' },
]

describe('pagefindPlugin', () => {
  it('onIndexReady writes a JSON file to outputPath', async () => {
    const outputPath = join(tmpdir(), `cl3-test-${Date.now()}`, 'manifest.json')
    const plugin = pagefindPlugin({ outputPath, fields: ['title', 'body'] })
    await plugin.onIndexReady(items)
    const raw = await readFile(outputPath, 'utf-8')
    const parsed = JSON.parse(raw)
    expect(Array.isArray(parsed)).toBe(true)
    await rm(join(tmpdir(), `cl3-test-${Date.now() - 1}`), { recursive: true, force: true })
  })

  it('written JSON contains url and content fields per item', async () => {
    const outputPath = join(tmpdir(), `cl3-test-${Date.now()}`, 'manifest.json')
    const plugin = pagefindPlugin({ outputPath, fields: ['title', 'body'] })
    await plugin.onIndexReady(items)
    const parsed = JSON.parse(await readFile(outputPath, 'utf-8'))
    expect(parsed[0]).toHaveProperty('url')
    expect(parsed[0]).toHaveProperty('content')
    expect(parsed[0]).toHaveProperty('meta')
  })

  it('only specified fields are included in manifest meta', async () => {
    const outputPath = join(tmpdir(), `cl3-test-${Date.now()}`, 'manifest.json')
    const plugin = pagefindPlugin({ outputPath, fields: ['title'] })
    await plugin.onIndexReady(items)
    const parsed = JSON.parse(await readFile(outputPath, 'utf-8'))
    expect(Object.keys(parsed[0].meta)).toEqual(['title'])
    expect(parsed[0].meta).not.toHaveProperty('body')
  })

  it('non-existent outputPath directory is created automatically', async () => {
    const dir = join(tmpdir(), `cl3-test-${Date.now()}`, 'deep', 'nested')
    const outputPath = join(dir, 'manifest.json')
    const plugin = pagefindPlugin({ outputPath, fields: ['title'] })
    await plugin.onIndexReady(items)
    const parsed = JSON.parse(await readFile(outputPath, 'utf-8'))
    expect(parsed.length).toBe(2)
  })

  it('urlField option is used when specified', async () => {
    const outputPath = join(tmpdir(), `cl3-test-${Date.now()}`, 'manifest.json')
    const plugin = pagefindPlugin({ outputPath, fields: ['title'], urlField: 'title' })
    await plugin.onIndexReady(items)
    const parsed = JSON.parse(await readFile(outputPath, 'utf-8'))
    expect(parsed[0].url).toBe('Hello World')
  })
})
