# Contentlayer3: Runtime-First Content Layer for Next.js

Contentlayer3 brings your content (be it local files or remote content via APIs) into Next.js as fully typed, Zod-validated data, fetched at request time instead of baked in at build.

[Jump to feature comparison](#feature-comparison)

> [!NOTE]
> The npm library is coming soon. This repository is a work in progress.

## Why we're making a new Contentlayer

**Contentlayer** is unmaintained. **Velite** and **content-collections** are build-time only, blocking on full builds. **Contentlayer3** runs at request time with Next.js ISR and `revalidateTag`, giving you:

- **Runtime-first**: Fetch and validate content on every request (with intelligent caching)
- **Edge-safe core**: The `contentlayer3` package runs on Cloudflare Workers and Vercel Edge Functions
- **Zod-only**: Single schema system, no competing frameworks
- **Remote sources**: Pull content from any HTTP API
- **Search plugins**: Orama and Pagefind integration out-of-the-box
- **Actively maintained**: New phases ship regularly

## 5-Minute Quickstart

### 1. Install

```bash
pnpm add contentlayer3 zod
```

### 2. Create `cl3.config.ts`

```typescript
import { defineCollection } from "contentlayer3";
import { filesystem } from "contentlayer3/source-files";
import { z } from "zod";

export const posts = defineCollection({
  name: "posts",
  source: filesystem({
    contentDir: "content/posts",
    pattern: "**/*.mdx",
  }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    excerpt: z.string(),
    _filePath: z.string().optional(),
  }),
});
```

### 3. Add content

Create `content/posts/hello.mdx`:

```markdown
---
title: Hello World
date: 2025-01-01
excerpt: My first post
---

This is my first post!
```

### 4. Use in a page

```typescript
import { getCollection } from 'contentlayer3'
import { posts } from '../cl3.config'

export default async function Blog() {
  const allPosts = await getCollection(posts)
  return (
    <main>
      <h1>Blog</h1>
      <ul>
        {allPosts.map(post => (
          <li key={post._filePath}>{post.title}</li>
        ))}
      </ul>
    </main>
  )
}
```

### 5. Revalidate on demand

Create `app/api/revalidate/route.ts`:

```typescript
import { revalidateCollection } from "contentlayer3";
import { posts } from "../../../cl3.config";

export async function POST(request: Request) {
  const token = request.headers.get("x-revalidate-token");
  if (token !== process.env.REVALIDATE_TOKEN) {
    return new Response("Unauthorized", { status: 401 });
  }
  revalidateCollection(posts.name);
  return new Response("Revalidated", { status: 200 });
}
```

## Package Map

| Package                    | Purpose                                                       | Edge-Safe |
| -------------------------- | ------------------------------------------------------------- | --------- |
| `contentlayer3`            | Collection definition, validation, in-memory cache, Next.js integration, MDX, and filesystem source | ✓ (core + remote) |
| `@contentlayer3/source-remote` | HTTP remote content source with offset/cursor pagination  | ✓         |
| `@contentlayer3/search-orama`  | Full-text search with Orama v3                            | ✓         |
| `@contentlayer3/search-pagefind` | Pagefind manifest generation for static search          | ✗         |
| `@contentlayer3/devtools`  | CLI tools: `validate`, `inspect`, `watch`                     | ✗         |

### Subpath exports

| Import                         | Contents                                      |
| ------------------------------ | --------------------------------------------- |
| `contentlayer3`                | Core engine, Next.js adapter, revalidation    |
| `contentlayer3/source-files`   | Filesystem source (md, mdx, json, yaml)       |
| `contentlayer3/mdx`            | MDX compilation to function-body JSX          |

## Feature Comparison

| Feature                   | CL3 | Velite         | content-collections | contentlayer2  |
| ------------------------- | --- | -------------- | ------------------- | -------------- |
| Runtime-first             | ✓   | ✗              | ✗                   | ✗              |
| Zod schemas               | ✓   | ✓              | ✓                   | ✗              |
| revalidateTag integration | ✓   | ✗              | ✗                   | ✗              |
| Turbopack compatible      | ✓   | ⚠️<sup>1</sup> | ✓                   | ⚠️<sup>1</sup> |
| Remote sources            | ✓   | ✗              | ✗                   | ✗              |
| Edge-safe core            | ✓   | ✗              | ✗                   | ✗              |
| Search hooks              | ✓   | ✗              | ✗                   | ✗              |
| Actively maintained       | ✓   | ✓              | ✓                   | ✓              |

<sup>1</sup> Partial support. Build-step and webpack plugin dependencies cause known issues with Turbopack. Contentlayer3 has no build-time dependency, making Turbopack compatibility a non-issue.

## Documentation

- [Core / Next.js](./packages/contentlayer3/README.md)
- [Remote Source](./packages/source-remote/README.md)
- [Orama Search](./packages/search-orama/README.md)
- [Pagefind Search](./packages/search-pagefind/README.md)
- [Developer Tools](./packages/devtools/README.md)

## Migration from Contentlayer

The `migrate` codemod lives in `tools/migrate` and is under active development. It performs AST-level transforms on existing Contentlayer configs and imports.

## Examples

- [Next.js App Router](./apps/example-nextjs)
- [Pages Router](./apps/example-pages)
- [Edge Runtime](./apps/example-cloudflare)

## License

MIT
