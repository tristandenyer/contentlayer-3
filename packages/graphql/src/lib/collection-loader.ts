import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { zodObjectToGraphQLType } from './zod-to-graphql.js'
import type { CollectionDefinition } from './schema-builder.js'

/**
 * Sidecar config format for contentlayer3.graphql.json.
 *
 * Because contentlayer3.config.ts cannot be dynamically imported at runtime
 * (Node cannot execute raw TypeScript), collections are declared in a sidecar
 * file that the CLI reads.
 *
 * Format:
 *   {
 *     "collections": [
 *       { "name": "blog-posts", "fields": { "title": "string", "date": "string" } }
 *     ]
 *   }
 *
 * Supported field types: "string", "number", "boolean", "string[]", "number[]"
 */

interface SidecarField {
  type: 'string' | 'number' | 'boolean' | 'string[]' | 'number[]'
  optional?: boolean
}

interface SidecarCollection {
  name: string
  fields: Record<string, SidecarField | SidecarField['type']>
}

interface SidecarConfig {
  collections?: SidecarCollection[]
}

function sidecarFieldToZod(
  field: SidecarField | SidecarField['type']
): z.ZodTypeAny {
  const f: SidecarField = typeof field === 'string' ? { type: field } : field
  let base: z.ZodTypeAny

  switch (f.type) {
    case 'string': base = z.string(); break
    case 'number': base = z.number(); break
    case 'boolean': base = z.boolean(); break
    case 'string[]': base = z.array(z.string()); break
    case 'number[]': base = z.array(z.number()); break
    default: base = z.string()
  }

  return f.optional ? base.optional() : base
}

/**
 * Load collection definitions from contentlayer3.graphql.json.
 * Returns an empty array if the sidecar file does not exist.
 */
export async function loadCollections(): Promise<CollectionDefinition[]> {
  const cwd = process.cwd()
  const sidecarPath = resolve(cwd, 'contentlayer3.graphql.json')

  if (!existsSync(sidecarPath)) {
    return []
  }

  let parsed: SidecarConfig
  try {
    const raw = await readFile(sidecarPath, 'utf-8')
    parsed = JSON.parse(raw) as SidecarConfig
  } catch {
    return []
  }

  if (!Array.isArray(parsed.collections)) {
    return []
  }

  return parsed.collections
    .filter((c) => c.name && c.fields)
    .map((c) => {
      const shape: z.ZodRawShape = {}
      for (const [key, field] of Object.entries(c.fields)) {
        shape[key] = sidecarFieldToZod(field)
      }
      const schema = z.object(shape)

      // Pre-register the type so schema-builder doesn't need to re-derive the name
      zodObjectToGraphQLType(schema, toTypeName(c.name))

      return {
        name: c.name,
        schema,
        // getItems is a no-op at schema-generation time;
        // at runtime it is provided by the user via withCollections()
        getItems: async () => [],
      } satisfies CollectionDefinition
    })
}

function toTypeName(name: string): string {
  return name
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}
