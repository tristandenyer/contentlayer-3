import pc from 'picocolors'
import { writeSDL } from '../lib/sdl.js'
import { buildGraphQLSchema } from '../lib/schema-builder.js'
import { loadCollections } from '../lib/collection-loader.js'

/**
 * Generate .contentlayer3/generated/schema.graphql from all collections
 * defined in contentlayer3.config.ts.
 */
export async function runGenerate(): Promise<void> {
  process.stdout.write('Loading collections from contentlayer3.config.ts...  ')
  const collections = await loadCollections()

  if (collections.length === 0) {
    console.error(pc.red('No collections found in contentlayer3.config.ts.'))
    process.exit(1)
  }
  console.log(pc.green('✓'))

  process.stdout.write(`Building GraphQL schema from ${collections.length} collection(s)...  `)
  const schema = buildGraphQLSchema(collections)
  console.log(pc.green('✓'))

  process.stdout.write('Writing .contentlayer3/generated/schema.graphql...  ')
  const outPath = await writeSDL(schema)
  console.log(pc.green('✓'))

  console.log(pc.green(`\nSchema written to: ${outPath}`))
  console.log(pc.dim('\nCollections:'))
  for (const c of collections) {
    console.log(pc.dim(`  • ${c.name}`))
  }
}
