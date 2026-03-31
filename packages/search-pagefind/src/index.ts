export interface PagefindManifestOptions {
  outputPath: string
  fields: string[]
  urlField?: string
}

export function pagefindPlugin<T extends Record<string, unknown>>(
  options: PagefindManifestOptions
) {
  return {
    onIndexReady: async (items: T[]): Promise<void> => {
      const manifest = items.map((item) => ({
        url: String(item[options.urlField ?? '_filePath'] ?? ''),
        content: options.fields.map((f) => String(item[f] ?? '')).join(' '),
        meta: Object.fromEntries(
          options.fields.map((f) => [f, String(item[f] ?? '')])
        ),
      }))
      const { writeFile, mkdir } = await import('node:fs/promises')
      const { dirname } = await import('node:path')
      await mkdir(dirname(options.outputPath), { recursive: true })
      await writeFile(options.outputPath, JSON.stringify(manifest, null, 2))
    },
  }
}
