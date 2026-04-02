import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runSync } from '../src/commands/sync.js'
import type { LockFile, GovernedEntry } from '../src/lib/lock.js'

// ── module mocks ─────────────────────────────────────────────────────────────

vi.mock('../src/lib/postman-api.js', () => ({
  createPostmanClient: vi.fn((c) => c),
  getCollectionAsOpenAPI: vi.fn(),
}))

vi.mock('../src/lib/lock.js', () => ({
  readLock: vi.fn(),
}))

vi.mock('../src/lib/config-loader.js', () => ({
  loadRemoteSources: vi.fn(),
}))

vi.mock('../src/lib/generated.js', () => ({
  generatedSchemaExists: vi.fn(),
  hashGeneratedSchema: vi.fn(),
}))

vi.mock('../src/lib/hash.js', () => ({
  hashSpec: vi.fn(),
}))

// ── helpers ──────────────────────────────────────────────────────────────────

import { readLock } from '../src/lib/lock.js'
import { getCollectionAsOpenAPI } from '../src/lib/postman-api.js'
import { generatedSchemaExists, hashGeneratedSchema } from '../src/lib/generated.js'
import { hashSpec } from '../src/lib/hash.js'
import { loadRemoteSources } from '../src/lib/config-loader.js'

const mockReadLock = vi.mocked(readLock)
const mockGetSpec = vi.mocked(getCollectionAsOpenAPI)
const mockExists = vi.mocked(generatedSchemaExists)
const mockFileHash = vi.mocked(hashGeneratedSchema)
const mockHashSpec = vi.mocked(hashSpec)
const mockLoadSources = vi.mocked(loadRemoteSources)

const entry: GovernedEntry = {
  postmanCollectionId: 'col-1',
  postmanCollectionName: 'My API',
  specHash: 'sha256:match',
  generatedSchemaHash: 'sha256:file-match',
  lastSyncedAt: new Date().toISOString(),
  syncedBy: 'test',
  origin: 'pushed',
}

const lock: LockFile = {
  version: 1,
  postman: { workspaceId: 'ws-1', workspaceName: 'Test WS' },
  governed: { 'source-a': entry },
  unregistered: [],
  ignored: [],
}

beforeEach(() => {
  vi.resetAllMocks()
  process.env['POSTMAN_API_KEY'] = 'test-key'
  delete process.env['CL3_POSTMAN_STRICT_UNREGISTERED']
  mockLoadSources.mockResolvedValue([{ name: 'source-a', endpoint: '/api', governed: true }])
})

afterEach(() => {
  delete process.env['POSTMAN_API_KEY']
})

// Capture process.exit calls without actually exiting
function captureExit(): { code: number | undefined } {
  const captured: { code: number | undefined } = { code: undefined }
  vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
    captured.code = typeof code === 'number' ? code : undefined
    throw new Error(`process.exit(${code})`)
  })
  return captured
}

describe('runSync', () => {
  it('exits 0 when all sources are in sync', async () => {
    mockReadLock.mockResolvedValue(lock)
    mockGetSpec.mockResolvedValue('{"spec":1}')
    mockHashSpec.mockReturnValue('sha256:match')
    mockExists.mockResolvedValue(true)
    mockFileHash.mockResolvedValue('sha256:file-match')

    await expect(runSync({ ci: true })).resolves.toBeUndefined()
  })

  it('exits 1 when spec drift detected', async () => {
    mockReadLock.mockResolvedValue(lock)
    mockGetSpec.mockResolvedValue('{"spec":1}')
    mockHashSpec.mockReturnValue('sha256:different') // mismatch
    const captured = captureExit()

    await expect(runSync({ ci: true })).rejects.toThrow()
    expect(captured.code).toBe(1)
  })

  it('exits 2 when generated schema file was manually edited', async () => {
    mockReadLock.mockResolvedValue(lock)
    mockGetSpec.mockResolvedValue('{"spec":1}')
    mockHashSpec.mockReturnValue('sha256:match') // spec OK
    mockExists.mockResolvedValue(true)
    mockFileHash.mockResolvedValue('sha256:tampered') // file hash mismatch
    const captured = captureExit()

    await expect(runSync({ ci: true })).rejects.toThrow()
    expect(captured.code).toBe(2)
  })

  it('--ci flag is non-interactive (no prompts thrown)', async () => {
    mockReadLock.mockResolvedValue(lock)
    mockGetSpec.mockResolvedValue('{"spec":1}')
    mockHashSpec.mockReturnValue('sha256:match')
    mockExists.mockResolvedValue(true)
    mockFileHash.mockResolvedValue('sha256:file-match')

    // Should complete without any readline interaction
    await expect(runSync({ ci: true })).resolves.toBeUndefined()
  })

  it('exits 3 for unregistered sources in strict mode', async () => {
    process.env['CL3_POSTMAN_STRICT_UNREGISTERED'] = '1'
    mockReadLock.mockResolvedValue(lock)
    mockGetSpec.mockResolvedValue('{"spec":1}')
    mockHashSpec.mockReturnValue('sha256:match')
    mockExists.mockResolvedValue(true)
    mockFileHash.mockResolvedValue('sha256:file-match')
    // source-b is in config but not governed
    mockLoadSources.mockResolvedValue([
      { name: 'source-a', endpoint: '/api', governed: true },
      { name: 'source-b', endpoint: '/api2', governed: false },
    ])
    const captured = captureExit()

    await expect(runSync()).rejects.toThrow()
    expect(captured.code).toBe(3)
  })
})
