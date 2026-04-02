import type { CompileOptions } from '@mdx-js/mdx'

export interface MDXOptions {
  remarkPlugins?: CompileOptions['remarkPlugins']
  rehypePlugins?: CompileOptions['rehypePlugins']
  recmaPlugins?: CompileOptions['recmaPlugins']
}

export interface TocEntry {
  depth: number
  text: string
  slug: string
}

export interface MDXResult {
  code: string
  toc: TocEntry[]
  readingTime: number
}
