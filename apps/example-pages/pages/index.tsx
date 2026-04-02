import type { GetStaticProps, InferGetStaticPropsType } from 'next'
import { getCollectionPages } from 'contentlayer3'
import { posts } from '../cl3.config.js'

type Post = { title: string; date: string; excerpt: string; _filePath?: string }

export const getStaticProps: GetStaticProps<{ allPosts: Post[] }> = async () => {
  const allPosts = (await getCollectionPages(posts)) as Post[]
  return {
    props: { allPosts },
    revalidate: 60,
  }
}

export default function Home({ allPosts }: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>Blog (Pages Router)</h1>
      <ul>
        {allPosts.map((post) => (
          <li key={post._filePath} style={{ marginBottom: '1rem' }}>
            <strong>{post.title}</strong>
            <p>{post.excerpt}</p>
            <small>{post.date}</small>
          </li>
        ))}
      </ul>
    </main>
  )
}
