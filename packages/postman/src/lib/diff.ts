export interface SchemaDiff {
  added: string[]
  removed: string[]
  changed: Array<{ field: string; from: string; to: string }>
  unchanged: number
}

type PropMap = Record<string, string>

function extractProperties(spec: unknown): PropMap {
  const props: PropMap = {}

  try {
    const s = spec as Record<string, unknown>
    const paths = (s['paths'] ?? {}) as Record<string, unknown>

    for (const pathItem of Object.values(paths)) {
      const item = pathItem as Record<string, unknown>

      for (const method of ['get', 'post', 'put', 'patch']) {
        const op = item[method] as Record<string, unknown> | undefined
        if (!op) continue

        const responses = op['responses'] as Record<string, unknown> | undefined
        const ok = (responses?.['200'] ?? responses?.['201']) as Record<string, unknown> | undefined
        const content = ok?.['content'] as Record<string, unknown> | undefined
        const json = content?.['application/json'] as Record<string, unknown> | undefined
        const schema = json?.['schema'] as Record<string, unknown> | undefined
        const properties = schema?.['properties'] as
          | Record<string, { type?: string; nullable?: boolean }>
          | undefined
        const required = (schema?.['required'] as string[] | undefined) ?? []

        if (properties) {
          for (const [name, prop] of Object.entries(properties)) {
            const isRequired = required.includes(name)
            const type = prop.type ?? 'unknown'
            props[name] = isRequired ? type : `${type} (optional)`
          }
          return props
        }
      }
    }
  } catch {
    // unparseable — return empty
  }

  return props
}

export function diffOpenAPISpecs(oldSpec: string, newSpec: string): SchemaDiff {
  let oldObj: unknown
  let newObj: unknown

  try { oldObj = JSON.parse(oldSpec) } catch { oldObj = {} }
  try { newObj = JSON.parse(newSpec) } catch { newObj = {} }

  const oldProps = extractProperties(oldObj)
  const newProps = extractProperties(newObj)

  const added: string[] = []
  const removed: string[] = []
  const changed: Array<{ field: string; from: string; to: string }> = []
  let unchanged = 0

  for (const [name, type] of Object.entries(newProps)) {
    if (!(name in oldProps)) {
      added.push(`${name}: ${type}`)
    } else if (oldProps[name] !== type) {
      changed.push({ field: name, from: oldProps[name]!, to: type })
    } else {
      unchanged++
    }
  }

  for (const name of Object.keys(oldProps)) {
    if (!(name in newProps)) {
      removed.push(`${name}: ${oldProps[name]}`)
    }
  }

  return { added, removed, changed, unchanged }
}

export function formatDiff(diff: SchemaDiff, opts: { color?: boolean } = {}): string {
  const { color = true } = opts
  const lines: string[] = []

  const green = (s: string) => color ? `\x1b[32m${s}\x1b[0m` : s
  const red = (s: string) => color ? `\x1b[31m${s}\x1b[0m` : s
  const yellow = (s: string) => color ? `\x1b[33m${s}\x1b[0m` : s

  for (const field of diff.added) {
    lines.push(green(`  + ${field}`))
  }
  for (const field of diff.removed) {
    lines.push(red(`  - ${field}`))
  }
  for (const { field, from, to } of diff.changed) {
    lines.push(yellow(`  ~ ${field}: ${from} → ${to}`))
  }

  return lines.join('\n')
}
