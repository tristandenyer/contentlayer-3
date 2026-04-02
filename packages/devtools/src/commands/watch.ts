import { watch as fsWatch } from 'node:fs'
import { resolve } from 'node:path'
import pc from 'picocolors'
import { getCollectionBase } from 'contentlayer3'
import type { Collection } from 'contentlayer3'

export async function runWatch(
  collections: Record<string, Collection<any>>
): Promise<void> {
  console.log(pc.cyan('Watching for changes... (Ctrl+C to stop)'))

  const watchers: ReturnType<typeof fsWatch>[] = []

  for (const [, collection] of Object.entries(collections)) {
    const source = collection.source as { contentDir?: string }
    if (!source.contentDir) continue

    const dir = resolve(process.cwd(), source.contentDir)

    try {
      const watcher = fsWatch(dir, { recursive: true }, async (event, filename) => {
        console.log(pc.yellow(`[${collection.name}]`) + ` ${event}: ${filename ?? 'unknown'}`)
        try {
          const items = await getCollectionBase(collection, { fresh: true })
          console.log(pc.green(`  ✓ ${items.length} items validated`))
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(pc.red(`  ✗ Validation error: ${msg}`))
        }
      })
      watchers.push(watcher)
      console.log(`Watching: ${dir}`)
    } catch {
      console.warn(pc.yellow(`Warning: could not watch ${dir}`))
    }
  }

  if (watchers.length === 0) {
    console.warn(pc.yellow('No filesystem sources found to watch.'))
    return
  }

  process.on('SIGINT', () => {
    watchers.forEach(w => w.close())
    console.log('\nStopped watching.')
    process.exit(0)
  })

  await new Promise<void>(() => {}) // keep alive
}
