import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

export interface GovernedEntry {
  postmanCollectionId: string
  postmanCollectionName: string
  specHash: string
  generatedSchemaHash: string
  lastSyncedAt: string
  syncedBy: string
  origin: 'adopted' | 'pushed' | 'pulled'
}

export interface LockFile {
  version: 1
  postman: { workspaceId: string; workspaceName: string }
  governed: Record<string, GovernedEntry>
  unregistered: string[]
  ignored: string[]
}

function lockPath(): string {
  return resolve(process.cwd(), 'contentlayer3.lock')
}

export async function readLock(): Promise<LockFile | null> {
  const p = lockPath()
  if (!existsSync(p)) return null
  const raw = await readFile(p, 'utf-8')
  return JSON.parse(raw) as LockFile
}

export async function writeLock(lock: LockFile): Promise<void> {
  await writeFile(lockPath(), JSON.stringify(lock, null, 2) + '\n', 'utf-8')
}

export async function updateGovernedEntry(name: string, entry: GovernedEntry): Promise<void> {
  const lock = await readLock()
  if (!lock) throw new Error('contentlayer3.lock not found')
  lock.governed[name] = entry
  lock.unregistered = lock.unregistered.filter((n) => n !== name)
  await writeLock(lock)
}

export async function addUnregistered(name: string): Promise<void> {
  const lock = await readLock()
  if (!lock) throw new Error('contentlayer3.lock not found')
  if (!lock.governed[name] && !lock.ignored.includes(name) && !lock.unregistered.includes(name)) {
    lock.unregistered.push(name)
    await writeLock(lock)
  }
}

export async function removeUnregistered(name: string): Promise<void> {
  const lock = await readLock()
  if (!lock) return
  lock.unregistered = lock.unregistered.filter((n) => n !== name)
  await writeLock(lock)
}
