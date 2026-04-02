import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { LockFile, GovernedEntry } from '../src/lib/lock.js'

// lock.ts resolves relative to process.cwd() — override per test
let tmpDir: string
let originalCwd: () => string

async function importLock() {
  // Re-import to pick up the patched process.cwd
  return import('../src/lib/lock.js')
}

const makeLock = (overrides: Partial<LockFile> = {}): LockFile => ({
  version: 1,
  postman: { workspaceId: 'ws-1', workspaceName: 'My Workspace' },
  governed: {},
  unregistered: [],
  ignored: [],
  ...overrides,
})

const makeEntry = (overrides: Partial<GovernedEntry> = {}): GovernedEntry => ({
  postmanCollectionId: 'col-1',
  postmanCollectionName: 'My Collection',
  specHash: 'sha256:abc',
  generatedSchemaHash: 'sha256:def',
  lastSyncedAt: new Date().toISOString(),
  syncedBy: 'test',
  origin: 'pushed',
  ...overrides,
})

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'cl3-lock-test-'))
  originalCwd = process.cwd
  process.cwd = () => tmpDir
})

afterEach(async () => {
  process.cwd = originalCwd
  await rm(tmpDir, { recursive: true, force: true })
})

describe('readLock', () => {
  it('returns null when file does not exist', async () => {
    const { readLock } = await importLock()
    expect(await readLock()).toBeNull()
  })

  it('reads what writeLock wrote', async () => {
    const { readLock, writeLock } = await importLock()
    const lock = makeLock({ unregistered: ['source-a'] })
    await writeLock(lock)
    const result = await readLock()
    expect(result).toEqual(lock)
  })
})

describe('writeLock', () => {
  it('writes valid JSON to contentlayer3.lock', async () => {
    const { writeLock } = await importLock()
    const { readFile } = await import('node:fs/promises')
    const lock = makeLock()
    await writeLock(lock)
    const raw = await readFile(join(tmpDir, 'contentlayer3.lock'), 'utf-8')
    expect(() => JSON.parse(raw)).not.toThrow()
    expect(JSON.parse(raw)).toEqual(lock)
  })
})

describe('updateGovernedEntry', () => {
  it('updates single entry without touching others', async () => {
    const { writeLock, updateGovernedEntry, readLock } = await importLock()
    const entryA = makeEntry({ postmanCollectionId: 'col-a', postmanCollectionName: 'A' })
    const entryB = makeEntry({ postmanCollectionId: 'col-b', postmanCollectionName: 'B' })
    await writeLock(makeLock({ governed: { 'source-a': entryA } }))

    await updateGovernedEntry('source-b', entryB)
    const result = await readLock()
    expect(result?.governed['source-a']).toEqual(entryA)
    expect(result?.governed['source-b']).toEqual(entryB)
  })

  it('removes updated name from unregistered', async () => {
    const { writeLock, updateGovernedEntry, readLock } = await importLock()
    await writeLock(makeLock({ unregistered: ['source-a'] }))
    await updateGovernedEntry('source-a', makeEntry())
    const result = await readLock()
    expect(result?.unregistered).not.toContain('source-a')
  })

  it('throws when lock file does not exist', async () => {
    const { updateGovernedEntry } = await importLock()
    await expect(updateGovernedEntry('x', makeEntry())).rejects.toThrow('contentlayer3.lock not found')
  })
})

describe('addUnregistered', () => {
  it('adds to array without duplicates', async () => {
    const { writeLock, addUnregistered, readLock } = await importLock()
    await writeLock(makeLock())
    await addUnregistered('source-a')
    await addUnregistered('source-a')
    const result = await readLock()
    expect(result?.unregistered.filter((n) => n === 'source-a').length).toBe(1)
  })

  it('does not add if already governed', async () => {
    const { writeLock, addUnregistered, readLock } = await importLock()
    await writeLock(makeLock({ governed: { 'source-a': makeEntry() } }))
    await addUnregistered('source-a')
    const result = await readLock()
    expect(result?.unregistered).not.toContain('source-a')
  })

  it('does not add if already ignored', async () => {
    const { writeLock, addUnregistered, readLock } = await importLock()
    await writeLock(makeLock({ ignored: ['source-a'] }))
    await addUnregistered('source-a')
    const result = await readLock()
    expect(result?.unregistered).not.toContain('source-a')
  })
})

describe('removeUnregistered', () => {
  it('removes from array', async () => {
    const { writeLock, removeUnregistered, readLock } = await importLock()
    await writeLock(makeLock({ unregistered: ['source-a', 'source-b'] }))
    await removeUnregistered('source-a')
    const result = await readLock()
    expect(result?.unregistered).not.toContain('source-a')
    expect(result?.unregistered).toContain('source-b')
  })

  it('is a no-op when lock does not exist', async () => {
    const { removeUnregistered } = await importLock()
    await expect(removeUnregistered('x')).resolves.toBeUndefined()
  })
})
