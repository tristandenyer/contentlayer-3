import pc from 'picocolors'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { readLock, writeLock } from '../lib/lock.js'
import {
  createPostmanClient,
  listWorkspaces,
  createWorkspace,
  createCollection,
  getCollectionAsOpenAPI,
} from '../lib/postman-api.js'
import { hashSpec } from '../lib/hash.js'
import { openAPIToZodSchema, zodSchemaToOpenAPI } from '../lib/openapi.js'
import { writeGeneratedSchema, hashGeneratedSchema } from '../lib/generated.js'
import { loadRemoteSources } from '../lib/config-loader.js'
import type { LockFile, GovernedEntry } from '../lib/lock.js'

export async function runInit(): Promise<void> {
  const existing = await readLock()
  if (existing) {
    console.error(pc.red('Already initialized.'))
    console.error('Use `contentlayer3 postman adopt` or `contentlayer3 postman push` to add sources.')
    process.exit(1)
  }

  const apiKey = process.env['POSTMAN_API_KEY']
  if (!apiKey) {
    console.error(pc.red('POSTMAN_API_KEY is not set.'))
    process.exit(1)
  }

  const sources = await loadRemoteSources()
  if (sources.length === 0) {
    console.error(pc.red('No remote() sources found in contentlayer3.config.ts.'))
    process.exit(1)
  }

  const rl = readline.createInterface({ input, output })

  try {
    console.log(pc.bold('\nNo contentlayer3.lock found. Setting up Postman governance.\n'))

    const client = createPostmanClient({ apiKey })
    const workspaces = await listWorkspaces(client)

    // Workspace selection
    let workspaceId: string
    let workspaceName: string

    console.log('? Postman workspace to use:')
    console.log('  1. Create new workspace')
    if (workspaces.length > 0) {
      workspaces.forEach((w, i) => console.log(`  ${i + 2}. Use existing: ${w.name} (${w.id})`))
    }

    const choice = await rl.question('\nEnter number: ')
    const choiceNum = parseInt(choice.trim(), 10)

    if (choiceNum === 1) {
      const name = await rl.question('New workspace name: ')
      const { id } = await createWorkspace(client, name.trim())
      workspaceId = id
      workspaceName = name.trim()
      console.log(pc.green(`✓ Created workspace "${workspaceName}" (${workspaceId})`))
    } else {
      const ws = workspaces[choiceNum - 2]
      if (!ws) {
        console.error(pc.red('Invalid selection.'))
        process.exit(1)
      }
      workspaceId = ws.id
      workspaceName = ws.name
    }

    const clientWithWs = createPostmanClient({ apiKey, workspaceId })

    console.log(
      `\nFound ${sources.length} remote() source(s) in contentlayer3.config.ts:\n` +
        sources.map((s) => `  ${s.name}    ${s.endpoint}`).join('\n')
    )

    const confirm = await rl.question(`\n? Promote all ${sources.length} to Postman governance? (Y/n) `)
    const doAll = confirm.trim().toLowerCase() !== 'n'

    const toPromote = doAll
      ? sources
      : await (async () => {
          const selected = []
          for (const s of sources) {
            const ans = await rl.question(`? Promote '${s.name}'? (Y/n) `)
            if (ans.trim().toLowerCase() !== 'n') selected.push(s)
          }
          return selected
        })()

    if (toPromote.length === 0) {
      console.log(pc.yellow('No sources selected. Exiting.'))
      return
    }

    const lock: LockFile = {
      version: 1,
      postman: { workspaceId, workspaceName },
      governed: {},
      unregistered: sources.filter((s) => !toPromote.includes(s)).map((s) => s.name),
      ignored: [],
    }

    console.log('\nCreating Postman collections...')
    for (const source of toPromote) {
      try {
        const openapi = await zodSchemaToOpenAPI('', source.name)
        const { id: collectionId } = await createCollection(clientWithWs, source.name, openapi)
        const specStr = await getCollectionAsOpenAPI(clientWithWs, collectionId)
        const specHash = hashSpec(JSON.parse(specStr))
        const now = new Date().toISOString()

        const zodSource = await openAPIToZodSchema(specStr, source.name)
        await writeGeneratedSchema(source.name, zodSource)
        const generatedSchemaHash = (await hashGeneratedSchema(source.name))!

        const entry: GovernedEntry = {
          postmanCollectionId: collectionId,
          postmanCollectionName: source.name,
          specHash,
          generatedSchemaHash,
          lastSyncedAt: now,
          syncedBy: process.env['USER'] ?? 'unknown',
          origin: 'pushed',
        }

        lock.governed[source.name] = entry
        console.log(`  ${pc.green('✓')} ${source.name}    → "${source.name}"    ${collectionId}`)
        console.log(`    ${pc.dim(`.contentlayer3/generated/${source.name}.schema.ts`)}`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  ${pc.red('✗')} ${source.name}    ${msg}`)
      }
    }

    await writeLock(lock)
    console.log(pc.green('\nWriting contentlayer3.lock...  ✓'))
    console.log(
      pc.green(`\nAll ${toPromote.length} source(s) are now governed by Postman.`)
    )
    console.log('\nNext step: update your contentlayer3.config.ts to use fromPostman():')
    console.log(pc.dim('\n  import { fromPostman } from \'@contentlayer3/postman\''))
    console.log(pc.dim('  schema: fromPostman(\'blog-posts\').extend({ /* local fields */ })'))
  } finally {
    rl.close()
  }
}
