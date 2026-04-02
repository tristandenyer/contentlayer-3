import pc from 'picocolors'
import { readLock } from '../lib/lock.js'
import { createPostmanClient, getCollectionAsOpenAPI } from '../lib/postman-api.js'
import { hashSpec } from '../lib/hash.js'
import { generatedSchemaExists, hashGeneratedSchema } from '../lib/generated.js'
import { loadRemoteSources } from '../lib/config-loader.js'

interface SyncOptions {
  ci?: boolean
}

/**
 * CI-friendly drift check.
 *
 * Exit codes:
 *   0 — all governed sources in sync
 *   1 — one or more Postman specs have drifted
 *   2 — one or more generated schema files were manually edited
 *   3 — unregistered sources exist (only when CL3_POSTMAN_STRICT_UNREGISTERED=1)
 */
export async function runSync(opts: SyncOptions = {}): Promise<void> {
  const [lock, sources] = await Promise.all([readLock(), loadRemoteSources()])

  if (!lock) {
    console.error(pc.red('No contentlayer3.lock found. Run: contentlayer3 postman init'))
    process.exit(1)
  }

  const apiKey = process.env['POSTMAN_API_KEY']
  if (!apiKey) {
    console.error(pc.red('POSTMAN_API_KEY is not set.'))
    process.exit(1)
  }

  const client = createPostmanClient({ apiKey })
  const governed = Object.entries(lock.governed)

  // Build unregistered list: in config but not governed or ignored
  const governedNames = new Set(Object.keys(lock.governed))
  const ignoredNames = new Set(lock.ignored)
  const unregistered = sources
    .map((s) => s.name)
    .filter((n) => !governedNames.has(n) && !ignoredNames.has(n))

  if (opts.ci) {
    console.log(`Checking governance for ${governed.length} source(s)...`)
  }

  let specDriftCount = 0
  let fileTamperedCount = 0

  for (const [name, entry] of governed) {
    let specDrifted = false

    try {
      const specStr = await getCollectionAsOpenAPI(client, entry.postmanCollectionId)
      const currentHash = hashSpec(JSON.parse(specStr))
      if (currentHash !== entry.specHash) {
        specDrifted = true
        specDriftCount++
        const lastSynced = new Date(entry.lastSyncedAt).toLocaleDateString()
        console.log(
          `  ${pc.red('✗')} ${name}    ${pc.red('DRIFTED')} — Postman spec changed since ${lastSynced}`
        )
        console.log(`      Run: contentlayer3 postman pull ${name}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`  ${pc.yellow('?')} ${name}    could not fetch Postman spec: ${msg}`)
    }

    if (!specDrifted) {
      const exists = await generatedSchemaExists(name)
      if (!exists) {
        console.log(
          `  ${pc.red('✗')} ${name}    ${pc.red('MISSING')} — generated schema file missing`
        )
        fileTamperedCount++
      } else {
        const currentFileHash = await hashGeneratedSchema(name)
        if (currentFileHash !== entry.generatedSchemaHash) {
          fileTamperedCount++
          console.log(
            `  ${pc.red('✗')} ${name}    ${pc.red('TAMPERED')} — generated schema was manually edited`
          )
          console.log(`      Revert edits or run: contentlayer3 postman apply ${name}`)
        } else {
          console.log(`  ${pc.green('✓')} ${name}    in sync`)
        }
      }
    }
  }

  if (lock.ignored.length > 0 && !opts.ci) {
    for (const name of lock.ignored) {
      console.log(`  ${pc.dim('○')} ${name}    ${pc.dim('IGNORED')}`)
    }
  }

  if (unregistered.length > 0) {
    for (const name of unregistered) {
      console.log(`  ${pc.yellow('!')} ${name}    ${pc.yellow('UNREGISTERED')}`)
    }
  }

  console.log()

  if (specDriftCount > 0) {
    console.log(
      pc.red(`Governance check failed: ${specDriftCount} source(s) out of sync with Postman.`)
    )
    process.exit(1)
  }

  if (fileTamperedCount > 0) {
    console.log(
      pc.red(
        `Governance check failed: ${fileTamperedCount} generated schema file(s) were manually edited.`
      )
    )
    console.log(pc.dim('Generated files in .contentlayer3/generated/ must not be edited manually.'))
    process.exit(2)
  }

  const strictUnregistered = process.env['CL3_POSTMAN_STRICT_UNREGISTERED'] === '1'
  if (unregistered.length > 0 && strictUnregistered) {
    console.log(
      pc.yellow(`Warning: ${unregistered.length} unregistered source(s) found.`)
    )
    console.log(
      pc.dim('Run: contentlayer3 postman adopt <name>  or  contentlayer3 postman push <name>')
    )
    process.exit(3)
  }

  console.log(pc.green('All governed sources are in sync. ✓'))
}
