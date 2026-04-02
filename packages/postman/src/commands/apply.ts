import pc from 'picocolors'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { readFile, unlink, mkdir, writeFile } from 'node:fs/promises'
import { readLock, updateGovernedEntry } from '../lib/lock.js'
import { createPostmanClient, getCollectionAsOpenAPI } from '../lib/postman-api.js'
import { hashSpec } from '../lib/hash.js'
import { openAPIToZodSchema } from '../lib/openapi.js'
import { writeGeneratedSchema, hashGeneratedSchema } from '../lib/generated.js'
import { diffOpenAPISpecs } from '../lib/diff.js'
import type { GovernedEntry } from '../lib/lock.js'

const TMP_DIR = (cwd = process.cwd()) => resolve(cwd, '.contentlayer3', 'tmp')

export async function runApply(name: string): Promise<void> {
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

  const tmpDir = TMP_DIR()
  const diffPath = resolve(tmpDir, `${name}.diff.json`)

  if (!existsSync(diffPath)) {
    console.error(pc.red(`No pending pull found for '${name}'.`))
    console.error(`Run: contentlayer3 postman pull ${name}`)
    process.exit(1)
  }

  const apiKey = process.env['POSTMAN_API_KEY']
  if (!apiKey) {
    console.error(pc.red('POSTMAN_API_KEY is not set.'))
    process.exit(1)
  }

  const client = createPostmanClient({ apiKey })

  // Read the diff metadata written by pull
  const diffMeta = JSON.parse(await readFile(diffPath, 'utf-8'))

  process.stdout.write(`Fetching latest Postman spec for "${entry.postmanCollectionName}"...  `)
  const specStr = await getCollectionAsOpenAPI(client, entry.postmanCollectionId)
  console.log(pc.green('✓'))

  // Warn about removed/changed fields that may affect .extend() usage
  const specPath = resolve(tmpDir, `${name}.spec.json`)
  const prevSpecPath = resolve(tmpDir, `${name}.spec.prev.json`)

  if (existsSync(prevSpecPath)) {
    const prevStr = await readFile(prevSpecPath, 'utf-8')
    const diff = diffOpenAPISpecs(prevStr, specStr)

    if (diff.removed.length > 0) {
      console.log(pc.yellow(`\n⚠ ${diff.removed.length} field(s) removed from Postman spec:`))
      for (const field of diff.removed) {
        console.log(pc.yellow(`    - ${field}  (check your .extend() usage)`))
      }
    }

    if (diff.changed.length > 0) {
      console.log(pc.yellow(`\n⚠ ${diff.changed.length} field(s) changed in Postman spec:`))
      for (const { field, from, to } of diff.changed) {
        console.log(pc.yellow(`    ~ ${field}: ${from} → ${to}`))
      }
    }

    if (diff.removed.length > 0 || diff.changed.length > 0) {
      console.log()
    }
  }

  process.stdout.write(`Regenerating .contentlayer3/generated/${name}.schema.ts...  `)
  const zodSource = await openAPIToZodSchema(specStr, entry.postmanCollectionName)
  await writeGeneratedSchema(name, zodSource)
  const generatedSchemaHash = (await hashGeneratedSchema(name))!
  console.log(pc.green('✓'))

  const specHash = hashSpec(JSON.parse(specStr))
  const now = new Date().toISOString()

  const updatedEntry: GovernedEntry = {
    ...entry,
    specHash,
    generatedSchemaHash,
    lastSyncedAt: now,
    syncedBy: process.env['USER'] ?? 'unknown',
    origin: 'pulled',
  }

  await updateGovernedEntry(name, updatedEntry)

  // Promote current spec to prev for future diff baseline
  await mkdir(tmpDir, { recursive: true })
  await writeFile(prevSpecPath, specStr, 'utf-8')

  // Clean up diff.json and spec.json now that apply is done
  await unlink(diffPath)
  if (existsSync(specPath)) {
    await unlink(specPath)
  }

  console.log(pc.green('\ncontentlayer3.lock updated. ✓'))
  console.log(pc.dim('If any .extend() fields depended on removed or changed fields, update them now.'))
  console.log(pc.dim('Then run: contentlayer3 validate'))

  void diffMeta // consumed for context; individual fields used above
}
