import type { TransformResult, Warning } from '../types.js'

const GENERATED_IMPORT_COMMENT =
  '// Replace with: import { getCollection } from \'contentlayer3\'\n// See https://cl3.dev/migration for collection setup'

export function transformImports(source: string): TransformResult {
  const warnings: Warning[] = []
  let output = source
  let transformed = false

  // Handle contentlayer/generated and contentlayer2/generated imports
  const generatedRegex = /^(import\s+\{[^}]+\}\s+from\s+['"]contentlayer2?\/generated['"].*)$/gm
  if (generatedRegex.test(source)) {
    output = output.replace(
      /^(import\s+\{[^}]+\}\s+from\s+['"]contentlayer2?\/generated['"].*)$/gm,
      (match, importLine) => {
        const lineNum = source.slice(0, source.indexOf(match)).split('\n').length
        warnings.push({
          line: lineNum,
          message: `contentlayer/generated import needs manual update — replace with getCollection() calls`,
          requiresManualReview: true,
        })
        return `${GENERATED_IMPORT_COMMENT}\n// ${importLine}`
      }
    )
    transformed = true
  }

  // Remove next-contentlayer imports
  const nextContentlayerRegex = /import\s*\{[^}]*\}\s*from\s*['"]next-contentlayer['"]\s*\n?/g
  const newOutput = output.replace(nextContentlayerRegex, '')
  if (newOutput !== output) {
    output = newOutput
    transformed = true
    warnings.push({
      message: 'next-contentlayer import removed — no replacement needed in CL3',
      requiresManualReview: false,
    })
  }

  return { transformed, output, warnings }
}
