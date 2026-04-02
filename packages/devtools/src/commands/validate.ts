import pc from 'picocolors'
import { getCollectionBase } from 'contentlayer3'
import type { Collection } from 'contentlayer3'

export async function runValidate(
  collections: Record<string, Collection<any>>
): Promise<boolean> {
  let hasErrors = false

  for (const [, collection] of Object.entries(collections)) {
    try {
      const items = await getCollectionBase(collection, { fresh: true })
      console.log(pc.green(`✓ ${collection.name}`) + ` — ${items.length} items, 0 errors`)
    } catch (err) {
      hasErrors = true
      const msg = err instanceof Error ? err.message : String(err)
      console.error(pc.red(`✗ ${collection.name}`) + ` — ${msg}`)
    }
  }

  return hasErrors
}
