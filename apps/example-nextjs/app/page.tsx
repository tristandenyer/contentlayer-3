import { getCollection } from 'contentlayer3'
import { posts } from '../cl3.config.js'

export default async function Home() {
  const allPosts = await getCollection(posts)
  return (
    <main style={{ padding: '2rem' }}>
      <h1>Blog</h1>
      <ul>
        {allPosts.map((post) => (
          <li key={post._filePath} style={{ marginBottom: '1rem' }}>
            <a href={`/posts/${post._filePath?.split('/').pop()?.replace('.mdx', '')}`}>
              <strong>{post.title}</strong>
            </a>
            <p>{post.excerpt}</p>
            <small>{post.date}</small>
          </li>
        ))}
      </ul>
    </main>
  )
}
