import pc from 'picocolors'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { readLock, updateGovernedEntry, writeLock } from '../lib/lock.js'
import {
  createPostmanClient,
  listCollections,
  getCollectionAsOpenAPI,
} from '../lib/postman-api.js'
import { hashSpec } from '../lib/hash.js'
import { openAPIToZodSchema } from '../lib/openapi.js'
import { writeGeneratedSchema, hashGeneratedSchema } from '../lib/generated.js'
import { loadRemoteSources } from '../lib/config-loader.js'
import { diffOpenAPISpecs, formatDiff } from '../lib/diff.js'
import type { GovernedEntry } from '../lib/lock.js'
import type { Collection } from '../lib/postman-api.js'

export async function runAdopt(name?: string): Promise<void> {
  const lock = await readLock()
  if (!lock) {
    console.error(pc.red('No contentlayer3.lock found. Run: contentlayer3 postman init first.'))
    process.exit(1)
  }

  const apiKey = process.env['POSTMAN_API_KEY']
  if (!apiKey) {
    console.error(pc.red('POSTMAN_API_KEY is not set.'))
    process.exit(1)
  }

  const client = createPostmanClient({ apiKey, workspaceId: lock.postman.workspaceId })

  console.log(pc.bold('Connecting contentlayer3 to your existing Postman workspace.'))
  console.log(pc.dim('This command does not modify Postman. It only reads and maps.\n'))

  console.log(`Fetching collections from workspace "${lock.postman.workspaceName}"...`)
  const collections = await listCollections(client)
  console.log(`Found ${collections.length} collections.\n`)

  const sources = await loadRemoteSources()
  const sourcesToAdopt = name
    ? sources.filter((s) => s.name === name)
    : sources.filter((s) => !s.governed && !lock.ignored.includes(s.name))

  if (sourcesToAdopt.length === 0) {
    if (name) {
      console.error(pc.red(`Source '${name}' not found in config or already governed.`))
    } else {
      console.log(pc.green('No unregistered sources to adopt.'))
    }
    return
  }

  const rl = readline.createInterface({ input, output })

  try {
    for (const source of sourcesToAdopt) {
      console.log(pc.bold(`\nMapping source: ${source.name}  (${source.endpoint})`))

      // Let user pick the collection
      console.log('\nAvailable collections:')
      collections.forEach((c, i) => {
        const updated = c.updatedAt ? `  last updated ${c.updatedAt}` : ''
        console.log(`  ${i + 1}. ${c.name} (${c.id})${updated}`)
      })
      console.log(`  ${collections.length + 1}. None of the above — skip for now`)
      console.log(`  ${collections.length + 2}. None of the above — mark as ignored`)

      const ans = await rl.question('\n? Which Postman collection governs this source? ')
      const choiceNum = parseInt(ans.trim(), 10)

      if (choiceNum === collections.length + 1) {
        console.log(pc.dim(`  Skipping '${source.name}'.`))
        continue
      }

      if (choiceNum === collections.length + 2) {
        lock.ignored.push(source.name)
        lock.unregistered = lock.unregistered.filter((n) => n !== source.name)
        await writeLock(lock)
        console.log(pc.dim(`  '${source.name}' marked as ignored.`))
        continue
      }

      const targetCollection: Collection | undefined = collections[choiceNum - 1]
      if (!targetCollection) {
        console.log(pc.yellow('  Invalid selection — skipping.'))
        continue
      }

      console.log(`\n  Analyzing '${source.name}' ↔ ${targetCollection.name}...`)
      process.stdout.write('  Fetching Postman spec... ')
      const currentSpecStr = await getCollectionAsOpenAPI(client, targetCollection.id)
      console.log(pc.green('✓'))

      process.stdout.write('  Generating Zod schema from spec... ')
      const proposedZod = await openAPIToZodSchema(currentSpecStr, targetCollection.name)
      console.log(pc.green('✓'))

      // Diff against any previous spec on disk if available
      const { existsSync } = await import('node:fs')
      const { readFile } = await import('node:fs/promises')
      const { resolve } = await import('node:path')
      const prevPath = resolve(process.cwd(), '.contentlayer3/tmp', `${source.name}.spec.prev.json`)

      let hasDiff = false
      let diffOutput = ''

      if (existsSync(prevPath)) {
        const prevStr = await readFile(prevPath, 'utf-8')
        const diff = diffOpenAPISpecs(prevStr, currentSpecStr)
        hasDiff = diff.added.length + diff.removed.length + diff.changed.length > 0
        if (hasDiff) {
          diffOutput = formatDiff(diff)
          console.log('\n  DIFF FOUND:')
          console.log(diffOutput)
        }
      }

      let resolution: 'accept' | 'keep' | 'later' = 'accept'

      if (hasDiff) {
        console.log('\n  How do you want to proceed?')
        console.log('  1. Accept Postman as truth — update my schema to match (recommended)')
        console.log('  2. Keep my schema — update Postman to match')
        console.log('  3. Review later — establish governance but flag as drifted')

        const resAns = await rl.question('\n  Choice (1): ')
        const resNum = parseInt(resAns.trim() || '1', 10)
        if (resNum === 2) resolution = 'keep'
        else if (resNum === 3) resolution = 'later'
      }

      const specHash = hashSpec(JSON.parse(currentSpecStr))
      const now = new Date().toISOString()

      if (resolution === 'accept' || resolution === 'later') {
        await writeGeneratedSchema(source.name, proposedZod)
        const generatedSchemaHash = (await hashGeneratedSchema(source.name))!

        const entry: GovernedEntry = {
          postmanCollectionId: targetCollection.id,
          postmanCollectionName: targetCollection.name,
          specHash,
          generatedSchemaHash,
          lastSyncedAt: now,
          syncedBy: process.env['USER'] ?? 'unknown',
          origin: 'adopted',
        }

        await updateGovernedEntry(source.name, entry)
        console.log(pc.green(`\n  ✓ .contentlayer3/generated/${source.name}.schema.ts`))

        if (resolution === 'later') {
          console.log(pc.yellow(`  Flagged for review. Run: contentlayer3 postman pull ${source.name}`))
        } else {
          console.log(pc.green(`  Governance established for '${source.name}'.`))
        }
      } else {
        // 'keep' — push local schema up to Postman (delegate to push --update)
        console.log(
          pc.yellow(
            `  To push your local schema to Postman, run:\n  contentlayer3 postman push ${source.name} --update`
          )
        )
      }
    }
  } finally {
    rl.close()
  }

  console.log('\n' + pc.bold('ACTION REQUIRED:') + ' Update contentlayer3.config.ts to use fromPostman():')
  console.log(pc.dim('\n  import { fromPostman } from \'@contentlayer3/postman\''))
  console.log(pc.dim('  schema: fromPostman(\'<source-name>\').extend({'))
  console.log(pc.dim('    // Add any local-only fields here'))
  console.log(pc.dim('  })'))
}
