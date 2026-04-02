import { printSchema, type GraphQLSchema } from 'graphql'
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

/**
 * Print the SDL (Schema Definition Language) string for a GraphQL schema.
 */
export function printSDL(schema: GraphQLSchema): string {
  return printSchema(schema)
}

/**
 * Write the SDL to disk at .contentlayer3/generated/schema.graphql.
 */
export async function writeSDL(schema: GraphQLSchema, cwd = process.cwd()): Promise<string> {
  const dir = resolve(cwd, '.contentlayer3', 'generated')
  await mkdir(dir, { recursive: true })
  const outPath = resolve(dir, 'schema.graphql')
  await writeFile(outPath, printSchema(schema), 'utf-8')
  return outPath
}
