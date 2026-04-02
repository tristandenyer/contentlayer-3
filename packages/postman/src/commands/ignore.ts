import pc from 'picocolors'
import * as readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { readLock, writeLock } from '../lib/lock.js'

export async function runIgnore(name: string): Promise<void> {
  const lock = await readLock()

  if (!lock) {
    console.error(pc.red('No contentlayer3.lock found. Run: contentlayer3 postman init'))
    process.exit(1)
  }

  if (lock.ignored.includes(name)) {
    console.log(pc.yellow(`'${name}' is already ignored.`))
    return
  }

  const isGoverned = Boolean(lock.governed[name])

  if (isGoverned) {
    const entry = lock.governed[name]!
    console.log(
      pc.yellow(
        `⚠ WARNING: '${name}' is currently governed by Postman collection "${entry.postmanCollectionName}".`
      )
    )
    console.log('  Ignoring it will remove governance tracking.')
    console.log('  The Postman collection will not be deleted.\n')

    const rl = readline.createInterface({ input, output })
    try {
      const ans = await rl.question('? Confirm ignore? (y/N) ')
      if (ans.trim().toLowerCase() !== 'y') {
        console.log(pc.dim('Cancelled.'))
        return
      }
    } finally {
      rl.close()
    }

    delete lock.governed[name]
  }

  // Remove from unregistered if present
  lock.unregistered = lock.unregistered.filter((n) => n !== name)

  lock.ignored.push(name)
  await writeLock(lock)

  console.log(pc.green(`\n✓ '${name}' is now ignored.`))
  console.log(pc.dim('No drift warnings or governance prompts will be shown for this source.'))
  console.log(pc.dim(`To undo: remove '${name}' from the ignored array in contentlayer3.lock`))
}
