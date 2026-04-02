import type { MigrationSummary } from './types.js'

export function generateReport(summary: MigrationSummary): string {
  const lines: string[] = [
    '# CL3 Migration Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Files Modified',
    '',
  ]

  if (summary.filesModified.length === 0) {
    lines.push('_No files modified._')
  } else {
    for (const f of summary.filesModified) {
      lines.push(`- ${f}`)
    }
  }

  lines.push('', '## Transformations Applied', '')
  if (summary.transformations.length === 0) {
    lines.push('_No transformations applied._')
  } else {
    for (const t of summary.transformations) {
      lines.push(`- ${t}`)
    }
  }

  lines.push('', '## Items Requiring Manual Review', '')

  const manualItems = summary.warnings.filter((w) => w.requiresManualReview)
  if (manualItems.length === 0) {
    lines.push('_No manual review items._')
  } else {
    for (const w of manualItems) {
      const loc = w.line ? ` (line ${w.line})` : ''
      lines.push(`- **${w.file}**${loc}: ${w.message}`)
    }
  }

  lines.push(
    '',
    '## Known Unsupported Features',
    '',
    '- **Nested documentTypes**: Not yet supported in CL3. Requires manual schema composition.',
    '- **computedFields**: Replace with Zod `.transform()` on your schema.',
    '  Example: `schema: z.object({ title: z.string() }).transform(doc => ({ ...doc, url: `/posts/${doc._filePath}` }))`',
    '- **date field type**: CL3 stores dates as strings. Parse with `new Date(item.date)` at use site.',
    '- **allPosts/allDocs generated imports**: Replace with `getCollection(posts)` from `contentlayer3`.',
    '',
    '## Next Steps',
    '',
    '1. Review `cl3.config.ts` and verify schema fields match your content',
    '2. Update pages/components that imported from `contentlayer/generated`',
    '3. Remove `contentlayer` and `next-contentlayer` from package.json',
    '4. Run `pnpm add contentlayer3 zod`',
  )

  return lines.join('\n')
}
