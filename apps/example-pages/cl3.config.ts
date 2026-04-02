import { defineCollection } from 'contentlayer3'
import { filesystem } from 'contentlayer3/source-files'
import { z } from 'zod'

export const posts = defineCollection({
  name: 'pages-posts',
  source: filesystem({
    contentDir: '../example-nextjs/content/posts',
    pattern: '**/*.mdx',
  }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.string(),
    excerpt: z.string(),
    published: z.boolean().default(true),
    _filePath: z.string().optional(),
  }),
})
