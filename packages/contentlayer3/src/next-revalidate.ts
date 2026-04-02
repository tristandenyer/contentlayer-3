// @ts-expect-error next/cache is only available at runtime in Next.js projects
import { revalidateTag } from 'next/cache'

export function revalidateCollection(collectionName: string): void {
  revalidateTag(`cl3:${collectionName}`)
}

export function cl3Tags(collectionName: string): { tag: string; allTag: string } {
  return {
    tag: `cl3:${collectionName}`,
    allTag: 'cl3:all',
  }
}
