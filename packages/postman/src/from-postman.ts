import { z } from 'zod'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { hashFile } from './lib/hash.js'
import { CL3PostmanError, CL3PostmanUnregisteredError } from './lib/errors.js'
import type { LockFile } from './lib/lock.js'

const LOCK_FILENAME = 'contentlayer3.lock'
const GENERATED_DIR = '.contentlayer3/generated'

/**
 * Load the governance lock file synchronously (used at config-evaluation time).
 */
function loadLockSync(): LockFile | null {
  const lockPath = resolve(process.cwd(), LOCK_FILENAME)
  if (!existsSync(lockPath)) return null
  try {
    return JSON.parse(readFileSync(lockPath, 'utf-8')) as LockFile
  } catch {
    return null
  }
}

/**
 * Load and return the Zod schema for a governed source.
 *
 * Usage in contentlayer3.config.ts:
 *
 *   schema: fromPostman('blog-posts').extend({
 *     _slug: z.string(),
 *   })
 *
 * Throws CL3PostmanUnregisteredError if the source is not governed or
 * the generated file is missing.
 *
 * Throws CL3PostmanError if the generated file has been manually edited
 * (hash mismatch vs lock).
 *
 * Returns a z.ZodObject so that .extend() is available.
 */
export function fromPostman(sourceName: string): z.ZodObject<z.ZodRawShape> {
  const lock = loadLockSync()

  if (!lock || !lock.governed[sourceName]) {
    throw new CL3PostmanUnregisteredError(sourceName)
  }

  const entry = lock.governed[sourceName]!

  // Prefer the compiled .js file; fall back to .ts (e.g. tsx/ts-node environments)
  const tsPath = resolve(process.cwd(), GENERATED_DIR, `${sourceName}.schema.ts`)
  const jsPath = resolve(process.cwd(), GENERATED_DIR, `${sourceName}.schema.js`)
  const filePath = existsSync(jsPath) ? jsPath : tsPath

  if (!existsSync(filePath)) {
    throw new CL3PostmanUnregisteredError(sourceName)
  }

  // Integrity check: generated file must not have been manually edited
  const content = readFileSync(filePath, 'utf-8')
  const currentHash = hashFile(content)
  if (currentHash !== entry.generatedSchemaHash) {
    throw new CL3PostmanError(
      `Generated schema for '${sourceName}' has been manually edited. ` +
        `Run: contentlayer3 postman apply ${sourceName}  to regenerate it.`,
      'POSTMAN_SCHEMA_TAMPERED'
    )
  }

  // createRequire allows synchronous require() in an ESM package
  const _require = createRequire(import.meta.url)
  const mod = _require(filePath) as Record<string, unknown>

  // Generated files export `export const {PascalCase(name)}Schema = z.object({...})`
  const schemaKey = Object.keys(mod).find((k) => k.endsWith('Schema'))
  if (!schemaKey) {
    throw new CL3PostmanError(
      `Generated schema for '${sourceName}' does not export a *Schema value.`,
      'POSTMAN_SCHEMA_INVALID'
    )
  }

  const schema = mod[schemaKey]
  if (!(schema instanceof z.ZodObject)) {
    throw new CL3PostmanError(
      `Generated schema for '${sourceName}' is not a z.ZodObject.`,
      'POSTMAN_SCHEMA_INVALID'
    )
  }

  return schema
}
