import pc from 'picocolors'
import Table from 'cli-table3'
import { getCollectionBase } from 'contentlayer3'
import type { Collection } from 'contentlayer3'
import type { z } from 'zod'

export async function runInspect(
  collections: Record<string, Collection<any>>,
  filterName?: string
): Promise<void> {
  const targets = filterName
    ? Object.entries(collections).filter(([, c]) => c.name === filterName)
    : Object.entries(collections)

  if (filterName && targets.length === 0) {
    console.error(pc.red(`✗ Collection "${filterName}" not found.`))
    console.error(`Available: ${Object.values(collections).map(c => c.name).join(', ')}`)
    process.exit(1)
  }

  for (const [, collection] of targets) {
    let items: unknown[] = []
    let error: string | null = null
    try {
      items = await getCollectionBase(collection)
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }

    const table = new Table({ head: [], style: { head: [] } })

    // Get schema field names from zod object shape
    const schema = collection.schema as z.ZodObject<z.ZodRawShape>
    const fieldNames = schema.shape ? Object.keys(schema.shape) : []

    table.push(
      [pc.bold('Collection'), pc.cyan(collection.name)],
      ['Schema fields', fieldNames.join(', ') || '(none)'],
      ['Items', error ? pc.red(error) : String(items.length)]
    )

    console.log(table.toString())
    console.log()
  }
}
