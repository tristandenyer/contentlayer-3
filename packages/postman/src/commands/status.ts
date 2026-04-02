import pc from 'picocolors'
import { readLock } from '../lib/lock.js'
import { createPostmanClient, getCollectionAsOpenAPI } from '../lib/postman-api.js'
import { hashSpec } from '../lib/hash.js'
import { hashGeneratedSchema, generatedSchemaExists } from '../lib/generated.js'
import { loadRemoteSources } from '../lib/config-loader.js'
import { diffOpenAPISpecs, formatDiff } from '../lib/diff.js'

type SourceStatus =
  | { kind: 'GOVERNED_IN_SYNC'; name: string; collectionName: string; lastSyncedAt: string }
  | { kind: 'DRIFTED'; name: string; collectionName: string; lastSyncedAt: string; diffOutput: string }
  | { kind: 'FILE_EDITED'; name: string; collectionName: string }
  | { kind: 'UNREGISTERED'; name: string; endpoint: string }
  | { kind: 'IGNORED'; name: string }

export async function runStatus(opts: { offline?: boolean } = {}): Promise<void> {
  const lock = await readLock()
  if (!lock) {
    console.log(pc.yellow('No contentlayer3.lock found.'))
    console.log('Run: contentlayer3 postman init')
    return
  }

  const sources = await loadRemoteSources()

  // Build a unified name → endpoint map from config + lock
  const endpointMap = new Map(sources.map((s) => [s.name, s.endpoint]))

  // Collect all known names from both config and lock
  const allNames = new Set([
    ...sources.map((s) => s.name),
    ...Object.keys(lock.governed),
    ...lock.unregistered,
    ...lock.ignored,
  ])

  let client: ReturnType<typeof createPostmanClient> | null = null
  if (!opts.offline) {
    const apiKey = process.env['POSTMAN_API_KEY']
    if (apiKey) client = createPostmanClient({ apiKey })
  }

  const statuses: SourceStatus[] = []

  for (const name of allNames) {
    if (lock.ignored.includes(name)) {
      statuses.push({ kind: 'IGNORED', name })
      continue
    }

    if (lock.unregistered.includes(name)) {
      statuses.push({ kind: 'UNREGISTERED', name, endpoint: endpointMap.get(name) ?? '<unknown>' })
      continue
    }

    const entry = lock.governed[name]
    if (!entry) {
      // In config but not in lock at all — treat as unregistered
      statuses.push({ kind: 'UNREGISTERED', name, endpoint: endpointMap.get(name) ?? '<unknown>' })
      continue
    }

    if (opts.offline || !client) {
      // Offline: check generated file hash instead of hitting Postman
      const exists = await generatedSchemaExists(name)
      if (!exists) {
        statuses.push({ kind: 'FILE_EDITED', name, collectionName: entry.postmanCollectionName })
        continue
      }
      const fileHash = await hashGeneratedSchema(name)
      if (fileHash !== entry.generatedSchemaHash) {
        statuses.push({ kind: 'FILE_EDITED', name, collectionName: entry.postmanCollectionName })
      } else {
        statuses.push({
          kind: 'GOVERNED_IN_SYNC',
          name,
          collectionName: entry.postmanCollectionName,
          lastSyncedAt: entry.lastSyncedAt,
        })
      }
      continue
    }

    // Online: fetch Postman spec and compare hash
    try {
      const currentSpecStr = await getCollectionAsOpenAPI(client, entry.postmanCollectionId)
      const currentHash = hashSpec(JSON.parse(currentSpecStr))

      if (currentHash === entry.specHash) {
        statuses.push({
          kind: 'GOVERNED_IN_SYNC',
          name,
          collectionName: entry.postmanCollectionName,
          lastSyncedAt: entry.lastSyncedAt,
        })
      } else {
        // Compute field-level diff if we have a saved previous spec
        let diffOutput = ''
        const { existsSync } = await import('node:fs')
        const { readFile } = await import('node:fs/promises')
        const { resolve } = await import('node:path')
        const prevPath = resolve(process.cwd(), '.contentlayer3/tmp', `${name}.spec.prev.json`)
        if (existsSync(prevPath)) {
          const prevStr = await readFile(prevPath, 'utf-8')
          const diff = diffOpenAPISpecs(prevStr, currentSpecStr)
          diffOutput = formatDiff(diff)
        }
        statuses.push({
          kind: 'DRIFTED',
          name,
          collectionName: entry.postmanCollectionName,
          lastSyncedAt: entry.lastSyncedAt,
          diffOutput,
        })
      }
    } catch {
      // Network failure — fall back to offline check
      const fileHash = await hashGeneratedSchema(name)
      if (fileHash !== entry.generatedSchemaHash) {
        statuses.push({ kind: 'FILE_EDITED', name, collectionName: entry.postmanCollectionName })
      } else {
        statuses.push({
          kind: 'GOVERNED_IN_SYNC',
          name,
          collectionName: entry.postmanCollectionName,
          lastSyncedAt: entry.lastSyncedAt,
        })
      }
    }
  }

  // Print summary
  console.log(pc.bold(`Workspace: ${lock.postman.workspaceName} (${lock.postman.workspaceId})\n`))

  const inSync = statuses.filter((s) => s.kind === 'GOVERNED_IN_SYNC')
  const drifted = statuses.filter((s) => s.kind === 'DRIFTED')
  const fileEdited = statuses.filter((s) => s.kind === 'FILE_EDITED')
  const unregistered = statuses.filter((s) => s.kind === 'UNREGISTERED')
  const ignored = statuses.filter((s) => s.kind === 'IGNORED')

  if (inSync.length > 0 || drifted.length > 0 || fileEdited.length > 0) {
    console.log(pc.bold(`GOVERNED (${inSync.length + drifted.length + fileEdited.length})`))
    for (const s of statuses) {
      if (s.kind === 'GOVERNED_IN_SYNC') {
        const ago = timeAgo(s.lastSyncedAt)
        console.log(`  ${pc.green('✓')} ${s.name}    in sync    last synced ${ago}    Postman: ${s.collectionName}`)
      } else if (s.kind === 'DRIFTED') {
        const ago = timeAgo(s.lastSyncedAt)
        console.log(
          `  ${pc.yellow('⚠')} ${pc.yellow(s.name)}    DRIFTED    last synced ${ago}    Postman: ${s.collectionName}`
        )
        if (s.diffOutput) console.log(s.diffOutput)
        console.log(`    → contentlayer3 postman pull ${s.name}   (review the diff)`)
      } else if (s.kind === 'FILE_EDITED') {
        console.log(
          `  ${pc.red('✗')} ${pc.red(s.name)}    FILE_EDITED — generated schema was manually edited`
        )
        console.log(`    → restore from Postman: contentlayer3 postman apply ${s.name}`)
      }
    }
    console.log()
  }

  if (unregistered.length > 0) {
    console.log(pc.bold(`UNREGISTERED (${unregistered.length})`))
    for (const s of unregistered) {
      if (s.kind !== 'UNREGISTERED') continue
      console.log(`  ${pc.dim('○')} ${s.name}    ${pc.dim(s.endpoint)}`)
      console.log(`    → contentlayer3 postman push ${s.name}`)
      console.log(`    → contentlayer3 postman adopt ${s.name}`)
    }
    console.log()
  }

  if (drifted.length === 0 && !opts.offline && client) {
    console.log(pc.bold('DRIFTED (0)'))
    console.log('  (none)\n')
  }

  if (ignored.length > 0) {
    console.log(pc.bold(`IGNORED (${ignored.length})`))
    for (const s of ignored) {
      console.log(`  ${pc.dim('–')} ${s.name}`)
    }
  }
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes} minute(s) ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour(s) ago`
  const days = Math.floor(hours / 24)
  return `${days} day(s) ago`
}
