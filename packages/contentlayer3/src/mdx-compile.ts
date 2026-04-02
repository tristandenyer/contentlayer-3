import { compile } from '@mdx-js/mdx'
import { visit } from 'unist-util-visit'
import type { Heading } from 'mdast'
import type { MDXOptions, MDXResult, TocEntry } from './mdx-types.js'

function extractToc(tree: Parameters<typeof visit>[0]): TocEntry[] {
  const toc: TocEntry[] = []
  visit(tree, 'heading', (node: Heading) => {
    const text = node.children
      .filter((c) => c.type === 'text' || c.type === 'inlineCode')
      .map((c) => ('value' in c ? (c.value as string) : ''))
      .join('')
    const slug = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
    toc.push({ depth: node.depth, text, slug })
  })
  return toc
}

function computeReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  if (words === 0) return 0
  return Math.round((words / 200) * 10) / 10
}

export async function compileMDX(
  content: string,
  options?: MDXOptions
): Promise<MDXResult> {
  const toc: TocEntry[] = []

  const remarkTocPlugin = () => (tree: Parameters<typeof visit>[0]) => {
    const entries = extractToc(tree)
    toc.push(...entries)
  }

  const vfile = await compile(content, {
    outputFormat: 'function-body',
    remarkPlugins: [remarkTocPlugin, ...(options?.remarkPlugins ?? [])],
    rehypePlugins: options?.rehypePlugins ?? [],
    recmaPlugins: options?.recmaPlugins ?? [],
  })

  const code = String(vfile)
  const readingTime = computeReadingTime(content)

  return { code, toc, readingTime }
}
