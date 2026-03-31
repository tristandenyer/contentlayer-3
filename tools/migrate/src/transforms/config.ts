import type { TransformResult, Warning } from '../types.js'

const FIELD_TYPE_MAP: Record<string, string> = {
  string: 'z.string()',
  date: 'z.string()',
  boolean: 'z.boolean()',
  number: 'z.number()',
  json: 'z.unknown()',
  list: 'z.array(z.string())',
  markdown: 'z.string()',
  mdx: 'z.string()',
  image: 'z.string()',
  enum: 'z.string()',
}

const DATE_NOTE = '// CL3: date fields are z.string() — parse with new Date() as needed'

export function transformConfig(source: string): TransformResult {
  const warnings: Warning[] = []
  let output = source

  // 1. Replace import
  output = output.replace(
    /import\s*\{[^}]*defineDocumentType[^}]*\}\s*from\s*['"]contentlayer\/source-files['"]/g,
    `import { defineCollection } from '@cl3/core'\nimport { filesystem } from '@cl3/source-filesystem'\nimport { z } from 'zod'`
  )

  // 2. Extract contentDirPath and filePathPattern from makeSource/defineDocumentType
  const contentDirMatch = source.match(/contentDirPath:\s*['"]([^'"]+)['"]/)
  const contentDir = contentDirMatch?.[1] ?? 'content'

  // 3. Find all defineDocumentType blocks and transform each
  const docTypeRegex = /const\s+(\w+)\s*=\s*defineDocumentType\s*\(\s*\(\s*\)\s*=>\s*\(\s*\{([\s\S]*?)\}\s*\)\s*\)/g
  let match
  while ((match = docTypeRegex.exec(source)) !== null) {
    const [fullMatch, typeName, body] = match

    // Extract fields - match everything between fields: { and the closing }
    // We need to be careful about nested braces (like in computedFields)
    const fieldsStartIdx = body.indexOf('fields:')
    let fieldsContent = ''
    if (fieldsStartIdx !== -1) {
      let braceCount = 0
      let capturing = false
      for (let i = fieldsStartIdx; i < body.length; i++) {
        if (body[i] === '{' && !capturing) {
          capturing = true
          braceCount = 1
          continue
        }
        if (capturing) {
          if (body[i] === '{') braceCount++
          else if (body[i] === '}') braceCount--
          if (braceCount === 0) break
          fieldsContent += body[i]
        }
      }
    }
    const fieldsMatch = fieldsContent ? [null, fieldsContent] : null
    const filePathMatch = body.match(/filePathPattern:\s*['"]([^'"]+)['"]/)
    const filePathPattern = filePathMatch?.[1] ?? '**/*.md'
    const hasComputedFields = body.includes('computedFields')

    const zodFields: string[] = [
      '    _content: z.string(),',
      '    _filePath: z.string(),',
    ]

    if (fieldsMatch?.[1]) {
      const fieldLines = fieldsMatch[1].split('\n').map(l => l.trim()).filter(Boolean)
      let i = 0
      while (i < fieldLines.length) {
        const line = fieldLines[i]
        const fieldNameMatch = line.match(/^(\w+)\s*:\s*\{/)
        if (fieldNameMatch) {
          const fieldName = fieldNameMatch[1]
          // Collect the field block
          const blockLines = [line]
          let braceCount = (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
          i++
          while (i < fieldLines.length && braceCount > 0) {
            const l = fieldLines[i]
            braceCount += (l.match(/\{/g) ?? []).length - (l.match(/\}/g) ?? []).length
            blockLines.push(l)
            i++
          }
          const block = blockLines.join(' ')
          const typeMatch = block.match(/type:\s*['"](\w+)['"]/)
          const requiredMatch = block.match(/required:\s*(true|false)/)
          const fieldType = typeMatch?.[1] ?? 'string'
          const isRequired = requiredMatch?.[1] !== 'false'
          const zodType = FIELD_TYPE_MAP[fieldType]

          if (!zodType) {
            warnings.push({
              message: `Unknown field type '${fieldType}' for field '${fieldName}' — defaulting to z.unknown()`,
              requiresManualReview: true,
            })
          }

          const baseType = zodType ?? 'z.unknown()'
          const finalType = isRequired ? baseType : `${baseType}.optional()`
          const note = fieldType === 'date' ? ` ${DATE_NOTE}` : ''
          zodFields.push(`    ${fieldName}: ${finalType},${note}`)
        } else {
          i++
        }
      }
    }

    if (hasComputedFields) {
      warnings.push({
        message: `computedFields in '${typeName}' require manual migration to schema .transform()`,
        requiresManualReview: true,
      })
    }

    const collectionName = typeName.charAt(0).toLowerCase() + typeName.slice(1) + 's'
    const replacement = `// CL3: computedFields replaced by schema .transform()
export const ${collectionName} = defineCollection({
  name: '${collectionName}',
  source: filesystem({ contentDir: '${contentDir}', pattern: '${filePathPattern}' }),
  schema: z.object({
${zodFields.join('\n')}
  }),
})`

    output = output.replace(fullMatch, replacement)
  }

  // 4. Remove makeSource export
  output = output.replace(/export\s+default\s+makeSource\s*\([^)]*\)\s*/g, '')

  return { transformed: output !== source, output, warnings }
}
