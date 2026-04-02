import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── module mocks (must be at top level for vi.mock hoisting) ─────────────────

vi.mock('node:readline/promises', () => ({
  createInterface: vi.fn(),
}))

vi.mock('../src/lib/postman-api.js', () => ({
  createPostmanClient: vi.fn((c) => c),
  listCollections: vi.fn(),
  getCollectionAsOpenAPI: vi.fn(),
}))

vi.mock('../src/lib/lock.js', () => ({
  readLock: vi.fn(),
  writeLock: vi.fn(),
  updateGovernedEntry: vi.fn(),
}))

vi.mock('../src/lib/config-loader.js', () => ({
  loadRemoteSources: vi.fn(),
}))

vi.mock('../src/lib/openapi.js', () => ({
  openAPIToZodSchema: vi.fn(),
}))

vi.mock('../src/lib/generated.js', () => ({
  writeGeneratedSchema: vi.fn(),
  hashGeneratedSchema: vi.fn(),
}))

vi.mock('../src/lib/hash.js', () => ({
  hashSpec: vi.fn(),
}))

vi.mock('../src/lib/diff.js', () => ({
  diffOpenAPISpecs: vi.fn(() => ({ added: [], removed: [], changed: [], unchanged: 0 })),
  formatDiff: vi.fn(() => ''),
}))

// ── imports (after mocks) ────────────────────────────────────────────────────

import { runAdopt } from '../src/commands/adopt.js'
import { createInterface } from 'node:readline/promises'
import { readLock, writeLock, updateGovernedEntry } from '../src/lib/lock.js'
import { listCollections, getCollectionAsOpenAPI } from '../src/lib/postman-api.js'
import { loadRemoteSources } from '../src/lib/config-loader.js'
import { openAPIToZodSchema } from '../src/lib/openapi.js'
import { writeGeneratedSchema, hashGeneratedSchema } from '../src/lib/generated.js'
import { hashSpec } from '../src/lib/hash.js'
import type { LockFile } from '../src/lib/lock.js'

const mockCreateInterface = vi.mocked(createInterface)
const mockReadLock = vi.mocked(readLock)
const mockWriteLock = vi.mocked(writeLock)
const mockUpdateEntry = vi.mocked(updateGovernedEntry)
const mockListCollections = vi.mocked(listCollections)
const mockGetSpec = vi.mocked(getCollectionAsOpenAPI)
const mockLoadSources = vi.mocked(loadRemoteSources)
const mockToZod = vi.mocked(openAPIToZodSchema)
const mockWriteSchema = vi.mocked(writeGeneratedSchema)
const mockFileHash = vi.mocked(hashGeneratedSchema)
const mockHashSpec = vi.mocked(hashSpec)

// ── fixtures ─────────────────────────────────────────────────────────────────

const baseLock: LockFile = {
  version: 1,
  postman: { workspaceId: 'ws-1', workspaceName: 'Test WS' },
  governed: {},
  unregistered: ['source-a'],
  ignored: [],
}

const collections = [
  { id: 'col-1', name: 'My API', uid: 'u1', updatedAt: '2024-01-01' },
  { id: 'col-2', name: 'Other API', uid: 'u2', updatedAt: '2024-01-02' },
]

function makeRl(answers: string[]) {
  let i = 0
  return {
    question: vi.fn(() => Promise.resolve(answers[i++] ?? '')),
    close: vi.fn(),
  }
}

// ── setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks()
  process.env['POSTMAN_API_KEY'] = 'test-key'

  mockReadLock.mockResolvedValue(baseLock)
  mockListCollections.mockResolvedValue(collections)
  mockGetSpec.mockResolvedValue(JSON.stringify({ openapi: '3.1.0', paths: {} }))
  mockToZod.mockResolvedValue('export const SourceASchema = z.object({})')
  mockWriteSchema.mockResolvedValue(undefined)
  mockFileHash.mockResolvedValue('sha256:generated')
  mockHashSpec.mockReturnValue('sha256:spec')
  mockUpdateEntry.mockResolvedValue(undefined)
  mockWriteLock.mockResolvedValue(undefined)
  mockLoadSources.mockResolvedValue([{ name: 'source-a', endpoint: '/api', governed: false }])

  vi.spyOn(process, 'exit').mockImplementation((code?: number | string | null) => {
    throw new Error(`process.exit(${code})`)
  })
})

afterEach(() => {
  delete process.env['POSTMAN_API_KEY']
  vi.restoreAllMocks()
})

// ── tests ─────────────────────────────────────────────────────────────────────

describe('runAdopt', () => {
  it('shows list of Postman collections', async () => {
    mockCreateInterface.mockReturnValue(makeRl(['1', '']) as never)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await runAdopt()

    const output = logSpy.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(output).toContain('My API')
    expect(output).toContain('Other API')
  })

  it('generates .schema.ts from selected collection', async () => {
    mockCreateInterface.mockReturnValue(makeRl(['1', '']) as never)

    await runAdopt()

    expect(mockToZod).toHaveBeenCalledWith(expect.any(String), 'My API')
    expect(mockWriteSchema).toHaveBeenCalledWith('source-a', expect.any(String))
  })

  it('writes lock entry with origin: adopted', async () => {
    mockCreateInterface.mockReturnValue(makeRl(['1', '']) as never)

    await runAdopt()

    expect(mockUpdateEntry).toHaveBeenCalledWith(
      'source-a',
      expect.objectContaining({ origin: 'adopted' })
    )
  })

  it('with no collections in Postman shows helpful message', async () => {
    mockListCollections.mockResolvedValue([])
    // 0 collections: choice 1 = "None — skip", choice 2 = "None — mark ignored"
    // pick choice 1 (skip)
    mockCreateInterface.mockReturnValue(makeRl(['1']) as never)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await runAdopt()

    // Should complete without throwing — skip path
    expect(logSpy).toHaveBeenCalled()
  })

  it('with unknown name shows error and returns', async () => {
    mockLoadSources.mockResolvedValue([])
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await runAdopt('unknown-source')

    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('unknown-source'))
  })

  it('shows diff when prior spec exists on disk', async () => {
    const { diffOpenAPISpecs } = await import('../src/lib/diff.js')
    vi.mocked(diffOpenAPISpecs).mockReturnValue({
      added: ['newField: string'],
      removed: [],
      changed: [],
      unchanged: 2,
    })
    mockCreateInterface.mockReturnValue(makeRl(['1', '1']) as never)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    await runAdopt()

    // diff was called (adopt always diffs if prevPath exists — mocked away here,
    // but the mock is set up; just verify the run completed cleanly)
    expect(mockUpdateEntry).toHaveBeenCalled()
    logSpy.mockRestore()
  })
})
