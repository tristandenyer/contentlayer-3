import { z } from 'zod'
import { defineCollection } from '@cl3/core'
import { getCollection } from '@cl3/next'
import { filesystem } from '@cl3/source-filesystem'

const posts = defineCollection({
  name: 'posts',
  source: filesystem({ contentDir: 'content', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    _content: z.string(),
    _filePath: z.string(),
  }),
})

export default async function Home() {
  const items = await getCollection(posts)
  return (
    <main>
      <h1>CL3 Example</h1>
      <ul>
        {items.map((item) => (
          <li key={item._filePath}>{item.title}</li>
        ))}
      </ul>
    </main>
  )
}
