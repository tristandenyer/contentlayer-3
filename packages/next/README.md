# @cl3/next

Next.js adapter for CL3.

## Webhook Revalidation Pattern

Create a route handler at `app/api/revalidate/route.ts`:

```ts
import { revalidateCollection } from '@cl3/next'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { secret, collection } = await req.json()
  if (secret !== process.env.CL3_REVALIDATE_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  revalidateCollection(collection)
  return Response.json({ revalidated: true })
}
```

## Pages Router

Import from `@cl3/next/pages` for Pages Router usage. Falls back to in-memory cache since `unstable_cache` is not available in Pages Router context.
