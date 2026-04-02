import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { filesystem, CL3SourceError } from '../src/index.js'

const tmpDir = join(process.cwd(), '.test-tmp-fs')

beforeAll(() => {
  mkdirSync(join(tmpDir, 'posts'), { recursive: true })
  writeFileSync(join(tmpDir, 'posts', 'hello.md'), '---\ntitle: "Hello"\nauthor: "Alice"\n---\n# Content here')
  writeFileSync(join(tmpDir, 'posts', 'data.json'), JSON.stringify({ id: 1, name: 'test' }))
  writeFileSync(join(tmpDir, 'posts', 'config.yaml'), 'key: value\nnum: 42\n')
  writeFileSync(join(tmpDir, 'posts', 'ignored.txt'), 'plain text')
})

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('filesystem source', () => {
  it('load() returns array of objects', async () => {
    const src = filesystem({ contentDir: join(tmpDir, 'posts'), pattern: '**/*' })
    const items = await src.load()
    expect(Array.isArray(items)).toBe(true)
    expect(items.length).toBeGreaterThan(0)
  })

  it('.md files have _content string and frontmatter fields', async () => {
    const src = filesystem({ contentDir: join(tmpDir, 'posts'), pattern: '**/*.md' })
    const items = await src.load() as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    const item = items[0]
    expect(item._content).toBeTypeOf('string')
    expect(item.title).toBe('Hello')
    expect(item.author).toBe('Alice')
  })

  it('.json files are parsed correctly', async () => {
    const src = filesystem({ contentDir: join(tmpDir, 'posts'), pattern: '**/*.json' })
    const items = await src.load() as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe(1)
    expect(items[0].name).toBe('test')
  })

  it('.yaml files are parsed correctly', async () => {
    const src = filesystem({ contentDir: join(tmpDir, 'posts'), pattern: '**/*.yaml' })
    const items = await src.load() as Array<Record<string, unknown>>
    expect(items).toHaveLength(1)
    expect(items[0].key).toBe('value')
    expect(items[0].num).toBe(42)
  })

  it('non-matching extensions are excluded', async () => {
    const src = filesystem({
      contentDir: join(tmpDir, 'posts'),
      pattern: '**/*',
      extensions: ['md'],
    })
    const items = await src.load() as Array<Record<string, unknown>>
    expect(items.every((i) => (i._filePath as string).endsWith('.md'))).toBe(true)
  })

  it('contentDir that does not exist throws CL3SourceError', async () => {
    const src = filesystem({ contentDir: '/nonexistent/path/that/does/not/exist', pattern: '**/*.md' })
    await expect(src.load()).rejects.toThrow(CL3SourceError)
  })
})
