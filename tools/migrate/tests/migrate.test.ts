import { describe, it, expect } from 'vitest'
import { transformConfig } from '../src/transforms/config.js'
import { transformNextConfig } from '../src/transforms/next-config.js'
import { transformImports } from '../src/transforms/imports.js'
import { generateReport } from '../src/report.js'
import type { MigrationSummary } from '../src/types.js'

const contentlayerConfig = `import { defineDocumentType, makeSource } from 'contentlayer/source-files'

const Post = defineDocumentType(() => ({
  name: 'Post',
  filePathPattern: '**/*.mdx',
  contentType: 'mdx',
  fields: {
    title: { type: 'string', required: true },
    date: { type: 'date', required: true },
    published: { type: 'boolean', required: false },
    views: { type: 'number', required: true },
  },
  computedFields: {
    url: { type: 'string', resolve: (doc) => \`/posts/\${doc._raw.flattenedPath}\` }
  }
}))

export default makeSource({ contentDirPath: 'posts', documentTypes: [Post] })`

const nextConfigWithContentlayer = `import { withContentlayer } from 'next-contentlayer'
import type { NextConfig } from 'next'
const config: NextConfig = {}
export default withContentlayer(config)`

const pageWithGeneratedImport = `import { allPosts } from 'contentlayer/generated'
import { allPosts as allPosts2 } from 'contentlayer2/generated'

export default function Page() {
  return <div>{allPosts.length}</div>
}`

describe('transformConfig', () => {
  it('output contains defineCollection', () => {
    const result = transformConfig(contentlayerConfig)
    expect(result.output).toContain('defineCollection')
  })

  it('output contains z.string() for string field', () => {
    const result = transformConfig(contentlayerConfig)
    expect(result.output).toContain('z.string()')
  })

  it('output contains z.boolean() for boolean field', () => {
    const result = transformConfig(contentlayerConfig)
    expect(result.output).toContain('z.boolean()')
  })

  it('required: false fields become .optional()', () => {
    const result = transformConfig(contentlayerConfig)
    expect(result.output).toContain('.optional()')
  })

  it('warns about computedFields requiring manual review', () => {
    const result = transformConfig(contentlayerConfig)
    const manualWarnings = result.warnings.filter((w) => w.requiresManualReview)
    expect(manualWarnings.length).toBeGreaterThan(0)
    expect(manualWarnings[0].message).toContain('computedFields')
  })

  it('flags unknown field type in warnings', () => {
    const customConfig = `import { defineDocumentType, makeSource } from 'contentlayer/source-files'
const Doc = defineDocumentType(() => ({
  name: 'Doc',
  filePathPattern: '**/*.md',
  fields: {
    meta: { type: 'nested', required: true },
  },
}))
export default makeSource({ contentDirPath: 'docs', documentTypes: [Doc] })`
    const result = transformConfig(customConfig)
    const unknownWarnings = result.warnings.filter((w) => w.message.includes('Unknown field type'))
    expect(unknownWarnings.length).toBeGreaterThan(0)
  })
})

describe('transformNextConfig', () => {
  it('withContentlayer is removed from output', () => {
    const result = transformNextConfig(nextConfigWithContentlayer)
    expect(result.output).not.toContain('withContentlayer')
  })

  it('comment about no config needed is added', () => {
    const result = transformNextConfig(nextConfigWithContentlayer)
    expect(result.output).toContain('No next.config changes needed')
  })

  it('transformed is true when withContentlayer present', () => {
    const result = transformNextConfig(nextConfigWithContentlayer)
    expect(result.transformed).toBe(true)
  })

  it('transformed is false when withContentlayer not present', () => {
    const result = transformNextConfig('export default {}')
    expect(result.transformed).toBe(false)
  })
})

describe('transformImports', () => {
  it('contentlayer/generated import has migration comment', () => {
    const result = transformImports(pageWithGeneratedImport)
    expect(result.output).toContain('Replace with')
  })

  it('original import is commented out', () => {
    const result = transformImports(pageWithGeneratedImport)
    expect(result.output).toContain('// import { allPosts }')
  })

  it('warns about manual update needed', () => {
    const result = transformImports(pageWithGeneratedImport)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0].requiresManualReview).toBe(true)
  })

  it('contentlayer2/generated is also handled', () => {
    const result = transformImports(pageWithGeneratedImport)
    expect(result.output).toContain('// import { allPosts as allPosts2 }')
  })
})

describe('generateReport', () => {
  it('generates report with correct sections', () => {
    const summary: MigrationSummary = {
      filesModified: ['cl3.config.ts'],
      filesChecked: ['contentlayer.config.ts'],
      transformations: ['contentlayer.config.ts → cl3.config.ts'],
      warnings: [
        {
          file: 'contentlayer.config.ts',
          message: 'computedFields require manual migration',
          requiresManualReview: true,
          line: 10,
        },
      ],
    }
    const report = generateReport(summary)
    expect(report).toContain('# CL3 Migration Report')
    expect(report).toContain('## Files Modified')
    expect(report).toContain('## Transformations Applied')
    expect(report).toContain('## Items Requiring Manual Review')
    expect(report).toContain('cl3.config.ts')
    expect(report).toContain('computedFields')
  })

  it('report contains known unsupported features section', () => {
    const summary: MigrationSummary = {
      filesModified: [],
      filesChecked: [],
      transformations: [],
      warnings: [],
    }
    const report = generateReport(summary)
    expect(report).toContain('## Known Unsupported Features')
    expect(report).toContain('computedFields')
  })
})
