import pc from 'picocolors'
import { readLock } from '../lib/lock.js'
import { loadRemoteSources } from '../lib/config-loader.js'

export async function runDiscover(): Promise<void> {
  const [sources, lock] = await Promise.all([loadRemoteSources(), readLock()])

  if (sources.length === 0 && !lock) {
    console.log(pc.yellow('No contentlayer3.lock found and no remote() sources detected in config.'))
    console.log('Run: contentlayer3 postman init <source-name>')
    return
  }

  // Build unified list from config sources + lock entries
  const allNames = new Set([
    ...sources.map((s) => s.name),
    ...(lock ? Object.keys(lock.governed) : []),
    ...(lock ? lock.unregistered : []),
    ...(lock ? lock.ignored : []),
  ])

  const endpointMap = new Map(sources.map((s) => [s.name, s.endpoint]))

  // Column widths
  const nameWidth = Math.max(6, ...Array.from(allNames).map((n) => n.length)) + 2
  const endpointWidth = Math.max(8, ...Array.from(endpointMap.values()).map((e) => e.length)) + 2

  const header =
    pc.bold('NAME'.padEnd(nameWidth)) +
    pc.bold('ENDPOINT'.padEnd(endpointWidth)) +
    pc.bold('STATUS'.padEnd(18)) +
    pc.bold('POSTMAN COLLECTION')

  console.log(header)
  console.log('─'.repeat(nameWidth + endpointWidth + 18 + 20))

  for (const name of allNames) {
    const endpoint = endpointMap.get(name) ?? pc.dim('<not in config>')
    let status: string
    let collection = ''

    if (lock?.ignored.includes(name)) {
      status = pc.dim('IGNORED')
    } else if (lock?.governed[name]) {
      const entry = lock.governed[name]!
      status = pc.green('GOVERNED')
      collection = entry.postmanCollectionName
    } else if (lock?.unregistered.includes(name)) {
      status = pc.yellow('UNREGISTERED')
    } else {
      // In config but lock doesn't exist or doesn't know about it
      status = pc.yellow('UNREGISTERED')
    }

    console.log(
      name.padEnd(nameWidth) +
        endpoint.padEnd(endpointWidth) +
        status.padEnd(18) +
        (collection ? pc.dim(collection) : '')
    )
  }

  console.log()

  // Suggested actions
  const unregistered = Array.from(allNames).filter(
    (n) => !lock?.governed[n] && !lock?.ignored.includes(n)
  )

  if (unregistered.length > 0) {
    console.log(pc.bold('Suggested actions for unregistered sources:'))
    for (const name of unregistered) {
      console.log(`  ${pc.dim('→')} contentlayer3 postman adopt ${name}   (map to existing Postman collection)`)
      console.log(`  ${pc.dim('→')} contentlayer3 postman push ${name}    (create new Postman collection)`)
    }
  } else {
    console.log(pc.green('All sources are registered. ✓'))
  }
}
