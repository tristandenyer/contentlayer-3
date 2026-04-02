import pc from 'picocolors'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { readLock } from '../lib/lock.js'
import { createPostmanClient, getCollectionAsOpenAPI } from '../lib/postman-api.js'
import { hashSpec } from '../lib/hash.js'
import { diffOpenAPISpecs, formatDiff } from '../lib/diff.js'

const TMP_DIR = (cwd = process.cwd()) => resolve(cwd, '.contentlayer3', 'tmp')

export async function runPull(name: string): Promise<void> {
  const lock = await readLock()
  if (!lock) {
    console.error(pc.red('No contentlayer3.lock found. Run: contentlayer3 postman init'))
    process.exit(1)
  }

  const entry = lock.governed[name]
  if (!entry) {
    console.error(pc.red(`'${name}' is not governed.`))
    console.error(`Run: contentlayer3 postman adopt ${name}`)
    process.exit(1)
  }

  const apiKey = process.env['POSTMAN_API_KEY']
  if (!apiKey) {
    console.error(pc.red('POSTMAN_API_KEY is not set.'))
    process.exit(1)
  }

  const client = createPostmanClient({ apiKey })

  process.stdout.write(`Fetching current Postman spec for "${entry.postmanCollectionName}"...  `)
  const currentSpecStr = await getCollectionAsOpenAPI(client, entry.postmanCollectionId)
  const currentHash = hashSpec(JSON.parse(currentSpecStr))
  console.log(pc.green('✓'))

  const lastSynced = new Date(entry.lastSyncedAt).toLocaleDateString()
  console.log(`Comparing to last synced spec (${lastSynced})...\n`)

  if (currentHash === entry.specHash) {
    console.log(pc.green(`Already in sync. Nothing to pull.`))
    return
  }

  // Write current spec to tmp for apply to use and for field-level diff on next pull
  const tmpDir = TMP_DIR()
  await mkdir(tmpDir, { recursive: true })
  const specPath = resolve(tmpDir, `${name}.spec.json`)
  await writeFile(specPath, currentSpecStr, 'utf-8')

  // Field-level diff using previous spec if available
  const prevSpecPath = resolve(tmpDir, `${name}.spec.prev.json`)
  const total: number[] = []

  if (existsSync(prevSpecPath)) {
    const prevStr = await readFile(prevSpecPath, 'utf-8')
    const diff = diffOpenAPISpecs(prevStr, currentSpecStr)
    const changeCount = diff.added.length + diff.removed.length + diff.changed.length
    total.push(changeCount)

    console.log(`CHANGES IN POSTMAN (since your last sync):`)
    const diffOut = formatDiff(diff)
    if (diffOut) console.log(diffOut)
    console.log(`\n${changeCount} change(s) detected.`)
  } else {
    console.log(pc.yellow('Spec hash changed.'))
    console.log(pc.dim('(Field-level diff requires a prior apply run to establish baseline.)'))
  }

  // Write diff metadata for apply to consume
  const diffMeta = {
    name,
    collectionId: entry.postmanCollectionId,
    collectionName: entry.postmanCollectionName,
    previousSpecHash: entry.specHash,
    currentSpecHash: currentHash,
    pulledAt: new Date().toISOString(),
  }
  const diffPath = resolve(tmpDir, `${name}.diff.json`)
  await writeFile(diffPath, JSON.stringify(diffMeta, null, 2) + '\n', 'utf-8')

  console.log(pc.dim(`\nFull diff written to: .contentlayer3/tmp/${name}.diff.json`))
  console.log(`\nNext step:\n  contentlayer3 postman apply ${name}`)
}
