import type { MDXOptions, MDXResult } from './mdx-types.js'
import { compileMDX } from './mdx-compile.js'

export function withMDX(options?: MDXOptions) {
  return async function mdxTransform<T extends { _content: string }>(
    item: T
  ): Promise<T & { mdx: MDXResult }> {
    const result = await compileMDX(item._content, options)
    return { ...item, mdx: result }
  }
}
