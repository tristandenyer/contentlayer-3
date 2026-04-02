import pc from 'picocolors'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { readLock, updateGovernedEntry } from '../lib/lock.js'
import {
  createPostmanClient,
  listWorkspaces,
  createCollection,
  updateCollection,
  getCollectionAsOpenAPI,
} from '../lib/postman-api.js'
import { hashSpec } from '../lib/hash.js'
import { openAPIToZodSchema, zodSchemaToOpenAPI } from '../lib/openapi.js'
import { writeGeneratedSchema, hashGeneratedSchema } from '../lib/generated.js'
import { loadRemoteSources } from '../lib/config-loader.js'
import { diffOpenAPISpecs, formatDiff } from '../lib/diff.js'
import type { GovernedEntry } from '../lib/lock.js'

export async function runPush(name: string, opts: { update?: boolean } = {}): Promise<void> {
  const lock = await readLock()
  if (!lock) {
    console.error(pc.red('No contentlayer3.lock found. Run: contentlayer3 postman init'))
    process.exit(1)
  }

  const apiKey = process.env['POSTMAN_API_KEY']
  if (!apiKey) {
    console.error(pc.red('POSTMAN_API_KEY is not set.'))
    process.exit(1)
  }

  const client = createPostmanClient({ apiKey, workspaceId: lock.postman.workspaceId })
  const existingEntry = lock.governed[name]

  // ── --update: modify existing Postman collection ──────────────────────────
  if (opts.update) {
    if (!existingEntry) {
      console.error(pc.red(`'${name}' is not governed. Cannot update a non-governed source.`))
      console.error(`Run: contentlayer3 postman adopt ${name}  or  contentlayer3 postman push ${name}`)
      process.exit(1)
    }

    console.log(
      pc.yellow(`⚠ WARNING: This will update the Postman collection "${existingEntry.postmanCollectionName}".`)
    )
    console.log('  Other team members using this collection will see changes.')
    console.log('  The API team should review these changes before accepting them in Postman.\n')

    // Fetch current Postman state
    const currentPostmanSpec = await getCollectionAsOpenAPI(client, existingEntry.postmanCollectionId)
    const newLocalOpenAPI = await zodSchemaToOpenAPI('', name)

    const diff = diffOpenAPISpecs(currentPostmanSpec, newLocalOpenAPI)
    const total = diff.added.length + diff.removed.length + diff.changed.length

    if (total === 0) {
      console.log(pc.green('No changes to push. Postman is already in sync.'))
      return
    }

    console.log(`  Changes to be pushed:`)
    console.log(formatDiff(diff))
    console.log()

    const rl = readline.createInterface({ input, output })
    try {
      const ans = await rl.question('? Confirm update? (y/N) ')
      if (ans.trim().toLowerCase() !== 'y') {
        console.log(pc.dim('Push cancelled.'))
        return
      }
    } finally {
      rl.close()
    }

    await updateCollection(client, existingEntry.postmanCollectionId, newLocalOpenAPI)
    const updatedSpecStr = await getCollectionAsOpenAPI(client, existingEntry.postmanCollectionId)
    const specHash = hashSpec(JSON.parse(updatedSpecStr))
    const now = new Date().toISOString()

    const updatedEntry: GovernedEntry = {
      ...existingEntry,
      specHash,
      lastSyncedAt: now,
      syncedBy: process.env['USER'] ?? 'unknown',
    }

    await updateGovernedEntry(name, updatedEntry)
    console.log(pc.green(`\n✓ Postman collection "${existingEntry.postmanCollectionName}" updated.`))
    console.log('The API team has been notified via Postman workspace update.')
    return
  }

  // ── create: promote unregistered source into Postman ─────────────────────
  if (existingEntry) {
    console.error(
      pc.yellow(`'${name}' is already governed by "${existingEntry.postmanCollectionName}".`)
    )
    console.error(`To update the Postman collection: contentlayer3 postman push ${name} --update`)
    process.exit(1)
  }

  const sources = await loadRemoteSources()
  const source = sources.find((s) => s.name === name)
  if (!source) {
    console.error(pc.red(`Source '${name}' not found in contentlayer3.config.ts.`))
    process.exit(1)
  }

  const workspaces = await listWorkspaces(client)
  const workspace = workspaces[0]
  if (!workspace) {
    console.error(pc.red('No Postman workspaces found.'))
    process.exit(1)
  }

  process.stdout.write(`Converting '${name}' Zod schema to OpenAPI 3.1...  `)
  const openapi = await zodSchemaToOpenAPI('', name)
  console.log(pc.green('✓'))

  process.stdout.write(`Creating Postman collection in workspace "${lock.postman.workspaceName}"...  `)
  const { id: collectionId } = await createCollection(client, name, openapi)
  console.log(pc.green(`✓`))
  console.log(`  Collection: "${name}"  id: ${collectionId}`)

  const specStr = await getCollectionAsOpenAPI(client, collectionId)
  const specHash = hashSpec(JSON.parse(specStr))
  const now = new Date().toISOString()

  process.stdout.write(`Generating .contentlayer3/generated/${name}.schema.ts...  `)
  const zodSource = await openAPIToZodSchema(specStr, name)
  await writeGeneratedSchema(name, zodSource)
  const generatedSchemaHash = (await hashGeneratedSchema(name))!
  console.log(pc.green('✓'))

  const entry: GovernedEntry = {
    postmanCollectionId: collectionId,
    postmanCollectionName: name,
    specHash,
    generatedSchemaHash,
    lastSyncedAt: now,
    syncedBy: process.env['USER'] ?? 'unknown',
    origin: 'pushed',
  }

  await updateGovernedEntry(name, entry)

  console.log(pc.green(`\n'${name}' is now governed by Postman.`))
  console.log('The API team has been notified via Postman workspace update.')
}
