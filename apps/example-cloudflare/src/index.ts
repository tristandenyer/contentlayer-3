import { defineCollection, getCollectionBase } from 'contentlayer3'
import { remote } from '@cl3/source-remote'
import { z } from 'zod'

const posts = defineCollection({
  name: 'cf-posts',
  source: remote({
    endpoint: 'https://jsonplaceholder.typicode.com/posts',
  }),
  schema: z.object({
    id: z.number(),
    title: z.string(),
    body: z.string(),
    userId: z.number(),
  }),
})

export default {
  async fetch(_request: Request): Promise<Response> {
    const items = await getCollectionBase(posts)
    return new Response(JSON.stringify(items), {
      headers: { 'Content-Type': 'application/json' },
    })
  },
}
