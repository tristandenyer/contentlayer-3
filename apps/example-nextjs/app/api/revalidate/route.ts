import { revalidateCollection } from 'contentlayer3'
import { posts } from '../../../cl3.config.js'

export async function POST(request: Request) {
  const token = request.headers.get('x-revalidate-token')
  if (token !== process.env.REVALIDATE_TOKEN) {
    return new Response('Unauthorized', { status: 401 })
  }
  revalidateCollection(posts.name)
  return new Response('Revalidated', { status: 200 })
}
