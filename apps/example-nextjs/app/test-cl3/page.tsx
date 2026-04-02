import { z } from 'zod'
import { defineCollection, getCollection } from 'contentlayer3'
import { filesystem } from 'contentlayer3/source-files'

const posts = defineCollection({
  name: 'posts',
  source: filesystem({ contentDir: 'content', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    _content: z.string(),
    _filePath: z.string(),
  }),
})

export default async function TestPage() {
  const items = await getCollection(posts)
  return (
    <main>
      <h1>CL3 Test</h1>
      <ul>
        {items.map((item) => (
          <li key={item._filePath}>{item.title}</li>
        ))}
      </ul>
    </main>
  )
}
