import { describe, it, expect } from 'vitest'
import { diffOpenAPISpecs, formatDiff } from '../src/lib/diff.js'

// Minimal OpenAPI 3.x spec factory
function makeSpec(properties: Record<string, { type: string }>, required: string[] = []): string {
  return JSON.stringify({
    openapi: '3.1.0',
    paths: {
      '/items': {
        get: {
          responses: {
            '200': {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties,
                    required,
                  },
                },
              },
            },
          },
        },
      },
    },
  })
}

const baseSpec = makeSpec(
  { id: { type: 'string' }, title: { type: 'string' }, count: { type: 'integer' } },
  ['id', 'title']
)

describe('diffOpenAPISpecs', () => {
  it('detects added fields', () => {
    const newSpec = makeSpec(
      { id: { type: 'string' }, title: { type: 'string' }, count: { type: 'integer' }, slug: { type: 'string' } },
      ['id', 'title']
    )
    const diff = diffOpenAPISpecs(baseSpec, newSpec)
    expect(diff.added.some((f) => f.startsWith('slug'))).toBe(true)
    expect(diff.removed).toHaveLength(0)
  })

  it('detects removed fields', () => {
    const newSpec = makeSpec(
      { id: { type: 'string' }, title: { type: 'string' } },
      ['id', 'title']
    )
    const diff = diffOpenAPISpecs(baseSpec, newSpec)
    expect(diff.removed.some((f) => f.startsWith('count'))).toBe(true)
    expect(diff.added).toHaveLength(0)
  })

  it('detects changed field types (optional → required)', () => {
    const newSpec = makeSpec(
      { id: { type: 'string' }, title: { type: 'string' }, count: { type: 'integer' } },
      ['id', 'title', 'count'] // count becomes required
    )
    const diff = diffOpenAPISpecs(baseSpec, newSpec)
    const countChange = diff.changed.find((c) => c.field === 'count')
    expect(countChange).toBeDefined()
    expect(countChange?.from).toContain('optional')
    expect(countChange?.to).not.toContain('optional')
  })

  it('returns empty diff for identical specs', () => {
    const diff = diffOpenAPISpecs(baseSpec, baseSpec)
    expect(diff.added).toHaveLength(0)
    expect(diff.removed).toHaveLength(0)
    expect(diff.changed).toHaveLength(0)
    expect(diff.unchanged).toBeGreaterThan(0)
  })

  it('handles malformed JSON gracefully', () => {
    const diff = diffOpenAPISpecs('not json', baseSpec)
    expect(diff.added.length + diff.removed.length).toBeGreaterThanOrEqual(0)
  })
})

describe('formatDiff', () => {
  it('produces readable output with correct +/-/~ prefixes (no color)', () => {
    const diff = {
      added: ['slug: string'],
      removed: ['count: integer (optional)'],
      changed: [{ field: 'title', from: 'string (optional)', to: 'string' }],
      unchanged: 1,
    }
    const output = formatDiff(diff, { color: false })
    expect(output).toContain('+ slug: string')
    expect(output).toContain('- count: integer (optional)')
    expect(output).toContain('~ title: string (optional) → string')
  })

  it('returns empty string for empty diff', () => {
    expect(formatDiff({ added: [], removed: [], changed: [], unchanged: 3 }, { color: false })).toBe('')
  })

  it('applies ANSI color codes by default', () => {
    const diff = { added: ['slug: string'], removed: [], changed: [], unchanged: 0 }
    const output = formatDiff(diff)
    expect(output).toContain('\x1b[32m')
  })
})
