import { createHash } from 'node:crypto'

function deterministicStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return '[' + value.map(deterministicStringify).join(',') + ']'
  }
  const sorted = Object.keys(value as object)
    .sort()
    .map((k) => JSON.stringify(k) + ':' + deterministicStringify((value as Record<string, unknown>)[k]))
    .join(',')
  return '{' + sorted + '}'
}

/**
 * Deterministic hash — sorts object keys before stringifying.
 * Returns 'sha256:{hex}'
 */
export function hashSpec(spec: unknown): string {
  const str = deterministicStringify(spec)
  return 'sha256:' + createHash('sha256').update(str).digest('hex')
}

/**
 * Hash the string content of a file.
 * Returns 'sha256:{hex}'
 */
export function hashFile(content: string): string {
  return 'sha256:' + createHash('sha256').update(content).digest('hex')
}
