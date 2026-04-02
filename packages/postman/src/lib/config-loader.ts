import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { readLock } from './lock.js'

export interface RemoteSourceInfo {
  name: string
  endpoint: string
  governed: boolean
}

/**
 * Load remote source declarations from contentlayer3.postman.json.
 *
 * The sidecar file format:
 *
 *   {
 *     "sources": [
 *       { "name": "blog-posts", "endpoint": "https://api.example.com/posts" },
 *       { "name": "authors",    "endpoint": "https://api.example.com/authors" }
 *     ]
 *   }
 *
 * This file is committed alongside contentlayer3.config.ts and is the
 * authoritative list of remote() sources for Postman governance.
 *
 * Why a sidecar? The remote() function captures its endpoint inside a closure
 * and does not expose it on the returned object, so it cannot be introspected
 * by dynamically importing the compiled config.
 */
export async function loadRemoteSources(): Promise<RemoteSourceInfo[]> {
  const cwd = process.cwd()
  const sidecarPath = resolve(cwd, 'contentlayer3.postman.json')

  if (!existsSync(sidecarPath)) {
    return []
  }

  let parsed: { sources?: Array<{ name: string; endpoint: string }> }
  try {
    const raw = await readFile(sidecarPath, 'utf-8')
    parsed = JSON.parse(raw) as typeof parsed
  } catch {
    return []
  }

  if (!Array.isArray(parsed.sources)) {
    return []
  }

  const lock = await readLock()
  const governedNames = new Set(lock ? Object.keys(lock.governed) : [])

  return parsed.sources
    .filter((s) => s.name && s.endpoint)
    .map((s) => ({
      name: s.name,
      endpoint: s.endpoint,
      governed: governedNames.has(s.name),
    }))
}
