import pc from 'picocolors'
import { printSDL } from '../lib/sdl.js'
import { buildGraphQLSchema } from '../lib/schema-builder.js'
import { loadCollections } from '../lib/collection-loader.js'

/**
 * Print the GraphQL SDL to stdout.
 */
export async function runPrint(): Promise<void> {
  const collections = await loadCollections()

  if (collections.length === 0) {
    console.error(pc.red('No collections found in contentlayer3.config.ts.'))
    process.exit(1)
  }

  const schema = buildGraphQLSchema(collections)
  console.log(printSDL(schema))
}
