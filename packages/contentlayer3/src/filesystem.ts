import { resolve, relative } from 'node:path'
import { watch, existsSync } from 'node:fs'
import matter from 'gray-matter'
import { load as yamlLoad } from 'js-yaml'
import { readFile } from 'node:fs/promises'
import fg from 'fast-glob'
import type { CollectionSource } from './types.js'
import { CL3SourceError } from './errors.js'

export interface FilesystemSourceOptions {
  contentDir: string
  pattern: string | string[]
  extensions?: string[]
}

export function filesystem(options: FilesystemSourceOptions): CollectionSource<unknown> {
  const {
    contentDir,
    pattern,
    extensions = ['md', 'mdx', 'json', 'yaml', 'yml'],
  } = options

  return {
    async load(): Promise<unknown[]> {
      const absDir = resolve(process.cwd(), contentDir)
      const patterns = Array.isArray(pattern) ? pattern : [pattern]

      let files: string[]
      try {
        files = await fg(patterns, {
          cwd: absDir,
          absolute: true,
          onlyFiles: true,
        })
      } catch (err) {
        throw new CL3SourceError(
          contentDir,
          err instanceof Error ? err : new Error(String(err))
        )
      }

      if (files.length === 0 && !existsSync(absDir)) {
        throw new CL3SourceError(
          contentDir,
          new Error(`Content directory does not exist: ${absDir}`)
        )
      }

      const results: unknown[] = []

      for (const filePath of files) {
        const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
        if (!extensions.includes(ext)) continue

        const relPath = relative(process.cwd(), filePath)
        const raw = await readFile(filePath, 'utf-8')

        if (ext === 'md' || ext === 'mdx') {
          const { data, content } = matter(raw)
          const sourceFileName = relPath.split('/').pop() ?? relPath
          const sourceFileDir = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : '.'
          const flattenedPath = relPath.replace(/\.(md|mdx)$/, '')
          const _raw = {
            sourceFilePath: relPath,
            sourceFileName,
            sourceFileDir,
            flattenedPath,
            contentType: ext as 'md' | 'mdx',
          }
          results.push({ ...data, _content: content, body: { raw: content }, _filePath: relPath, _raw })
        } else if (ext === 'json') {
          try {
            const parsed = JSON.parse(raw) as Record<string, unknown>
            const sourceFileName = relPath.split('/').pop() ?? relPath
            const sourceFileDir = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : '.'
            const _raw = { sourceFilePath: relPath, sourceFileName, sourceFileDir, flattenedPath: relPath.replace(/\.json$/, ''), contentType: 'data' as const }
            results.push({ ...parsed, _filePath: relPath, _raw })
          } catch (err) {
            throw new CL3SourceError(
              filePath,
              err instanceof Error ? err : new Error(String(err))
            )
          }
        } else if (ext === 'yaml' || ext === 'yml') {
          const parsed = yamlLoad(raw) as Record<string, unknown>
          const sourceFileName = relPath.split('/').pop() ?? relPath
          const sourceFileDir = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : '.'
          const _raw = { sourceFilePath: relPath, sourceFileName, sourceFileDir, flattenedPath: relPath.replace(/\.ya?ml$/, ''), contentType: 'data' as const }
          results.push({ ...parsed, _filePath: relPath, _raw })
        }
      }

      return results
    },

    watch(onChange: () => void): () => void {
      const absDir = resolve(process.cwd(), contentDir)
      let debounceTimer: ReturnType<typeof setTimeout> | undefined

      const watcher = watch(absDir, { recursive: true }, () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(onChange, 300)
      })

      return () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        watcher.close()
      }
    },
  }
}
