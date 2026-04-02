import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Collection } from 'contentlayer3'

export async function loadCL3Config(configPath?: string): Promise<{
  collections: Record<string, Collection<any>>
}> {
  const cwd = process.cwd()

  let resolvedPath: string
  if (configPath) {
    resolvedPath = resolve(cwd, configPath)
  } else {
    const tsPath = resolve(cwd, 'cl3.config.ts')
    const jsPath = resolve(cwd, 'cl3.config.js')
    if (existsSync(tsPath)) {
      resolvedPath = tsPath
    } else if (existsSync(jsPath)) {
      resolvedPath = jsPath
    } else {
      throw new Error(`No cl3.config.ts or cl3.config.js found in ${cwd}`)
    }
  }

  const mod = await import(resolvedPath)
  const collections: Record<string, Collection<any>> = {}

  for (const [key, value] of Object.entries(mod)) {
    if (isCollection(value)) {
      collections[key] = value as Collection<any>
    }
  }

  return { collections }
}

function isCollection(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'source' in value &&
    'schema' in value
  )
}
