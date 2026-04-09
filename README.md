# Contentlayer3: Runtime-First Content Layer for Next.js

Contentlayer3 brings your content (be it local files or remote content via APIs) into Next.js as fully typed, Zod-validated data, fetched at request time instead of baked in at build.

[Jump to feature comparison](#feature-comparison)

> [!NOTE]
> The npm library is coming soon. This repository is a work in progress.

## Why we're making a new Contentlayer

The original **Contentlayer** is unmaintained. **Velite** and **content-collections** process content only at build time, requiring a full rebuild to pick up content changes. **Contentlayer3** runs at request time with Next.js ISR and `revalidateTag`, giving you:

- **Runtime-first**: Fetch and validate content on every request (with intelligent caching)
- **Edge-safe core**: The `contentlayer3` package is compatible with Cloudflare Workers and Vercel Edge Functions
- **Zod-only**: Single schema system, no competing frameworks
- **Computed fields**: Derive slugs, URLs, reading time, and more at definition time
- **Collection references**: Link collections together with type-safe `reference()` fields
- **Remote sources**: Pull content from any HTTP API
- **Postman governance**: Keep remote source schemas in sync with Postman collections
- **Search plugins**: Orama and Pagefind integration out-of-the-box
- **Actively maintained**: New phases ship regularly

## 5-Minute Quickstart

### 1. Install

```bash
npm add contentlayer3 zod
```

### 2. Create `contentlayer3.config.ts`

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
  computedFields: {
    slug: (post) =>
      post._filePath
        ?.replace(/\.mdx?$/, "")
        .split("/")
        .pop() ?? "",
    url: (post) =>
      `/posts/${post._filePath
        ?.replace(/\.mdx?$/, "")
        .split("/")
        .pop()}`,
  },
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
import { posts } from '../contentlayer3.config'

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
import { posts } from "../../../contentlayer3.config";

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

| Package                          | Purpose                                                                                             | Edge-Safe<sup>†</sup> |
| -------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------- |
| `contentlayer3`                  | Collection definition, validation, in-memory cache, Next.js integration, MDX, and filesystem source | 🟢 (core + remote)    |
| `@contentlayer3/source-remote`   | HTTP remote content source with offset/cursor pagination                                            | 🟢                    |
| `@contentlayer3/search-orama`    | Full-text search with Orama v3                                                                      | 🟢                    |
| `@contentlayer3/search-pagefind` | Pagefind manifest generation for static search                                                      | 🔴                    |
| `@contentlayer3/devtools`        | CLI tools: `validate`, `inspect`, `watch`                                                           | —                     |
| `@contentlayer3/postman`         | Postman governance CLI: sync remote source schemas with Postman collections                         | —                     |
| `@contentlayer3/graphql`         | GraphQL API plugin: expose collections via a type-safe GraphQL endpoint                             | 🟢                    |
| `@contentlayer3/mcp`             | MCP server for AI-assisted governance: query collections, diff Postman specs, validate schemas      | —                     |

<sup>†</sup> Contentlayer3 can run in edge runtimes such as Cloudflare Workers, Vercel Edge Functions, and similar environments that are not full Node.js.

### Subpath exports

| Import                       | Contents                                   |
| ---------------------------- | ------------------------------------------ |
| `contentlayer3`              | Core engine, Next.js adapter, revalidation |
| `contentlayer3/source-files` | Filesystem source (md, mdx, json, yaml)    |
| `contentlayer3/mdx`          | MDX compilation to function-body JSX       |

## Feature Comparison

| Feature                   | contentlayer3  | Velite         | content-collections | contentlayer2  |
| ------------------------- | -------------- | -------------- | ------------------- | -------------- |
| Runtime-first             | 🟢             | 🔴             | 🔴                  | 🔴             |
| Zod schemas               | 🟢             | 🟢             | 🟢                  | 🔴             |
| revalidateTag integration | 🟢             | 🔴             | 🔴                  | 🔴             |
| Turbopack compatible      | 🟢             | 🟡<sup>1</sup> | 🟢                  | 🟡<sup>1</sup> |
| Computed fields           | 🟢             | 🟢             | 🟢                  | 🟢             |
| Collection references     | 🟢             | 🔴             | 🔴                  | 🟢             |
| Remote sources            | 🟢             | 🔴             | 🔴                  | 🔴             |
| Edge-safe core            | 🟢             | 🔴             | 🔴                  | 🔴             |
| Search hooks              | 🟢             | 🔴             | 🔴                  | 🔴             |
| Postman governance        | 🟢             | 🔴             | 🔴                  | 🔴             |
| GraphQL API               | 🟢             | 🔴             | 🔴                  | 🟢             |
| Build-time/static output  | 🔴<sup>2</sup> | 🟢             | 🟢                  | 🟢             |
| Actively maintained       | 🟢             | 🟢             | 🟢                  | 🟢             |

<sup>1</sup> Partial support. Build-step and webpack plugin dependencies cause known issues with Turbopack. Contentlayer3 has no build-time dependency, making Turbopack compatibility a non-issue.

<sup>2</sup> By design. Contentlayer3 fetches content at request time, sidestepping bundler dependency.

## Computed Fields

Derive values from validated items at definition time. Computed fields are applied after Zod validation, before caching, so they're always present when you call `getCollection`.

```typescript
import { defineCollection } from "contentlayer3";
import { filesystem } from "contentlayer3/source-files";
import { z } from "zod";

export const posts = defineCollection({
  name: "posts",
  source: filesystem({ contentDir: "content/posts", pattern: "**/*.mdx" }),
  schema: z.object({
    title: z.string(),
    date: z.string(),
    _filePath: z.string(),
  }),
  computedFields: {
    slug: (post) =>
      post._filePath
        .replace(/\.mdx?$/, "")
        .split("/")
        .pop(),
    url: (post) =>
      `/posts/${post._filePath
        .replace(/\.mdx?$/, "")
        .split("/")
        .pop()}`,
    // async fields are awaited automatically
    readingTime: async (post) => estimateReadingTime(post._filePath),
  },
});
```

## Collection References

Link collections together with `reference()`. The field stores the ID at rest; use `resolveReference` or `resolveReferences` to hydrate when needed.

```typescript
import { defineCollection, reference, resolveReference } from "contentlayer3";
import { z } from "zod";

export const authors = defineCollection({
  name: "authors",
  source: filesystem({ contentDir: "content/authors", pattern: "**/*.md" }),
  schema: z.object({ name: z.string(), slug: z.string() }),
});

export const posts = defineCollection({
  name: "posts",
  source: filesystem({ contentDir: "content/posts", pattern: "**/*.mdx" }),
  schema: z.object({
    title: z.string(),
    author: reference(authors), // stored as slug string
  }),
});

// In your page:
const post = await getCollectionItem(posts, (p) => p.slug === params.slug);
const author = await resolveReference(authors, post.author);
```

`resolveReference` matches on `slug`, `id`, or `_filePath`. Use `resolveReferences(collection, ids[])` for array fields like `tags` or `coAuthors`.

## Postman Governance

`@contentlayer3/postman` keeps your remote source schemas in sync with Postman collections via a lock-file governance workflow.

```bash
npm add -D @contentlayer3/postman
export POSTMAN_API_KEY=your-key
contentlayer3-postman init      # first-time setup
contentlayer3-postman pull <name>   # fetch latest spec from Postman
contentlayer3-postman apply <name>  # promote pulled spec, regenerate schema
contentlayer3-postman sync      # CI drift check (exits non-zero on drift)
```

See [Postman Governance](./packages/postman/README.md) for the full command reference.

## GraphQL API

`@contentlayer3/graphql` exposes your collections as a type-safe GraphQL endpoint. Zod schemas are automatically converted to GraphQL types.

```bash
npm add @contentlayer3/graphql
```

```typescript
// app/api/graphql/route.ts
import { withCollections } from "@contentlayer3/graphql";
import { getCollection } from "contentlayer3";
import { posts } from "../../../contentlayer3.config";

export const { GET, POST } = withCollections([
  { name: "posts", schema: posts.schema, getItems: () => getCollection(posts) },
]);
```

Generate a `schema.graphql` SDL file:

```bash
contentlayer3-graphql generate
```

See [GraphQL Plugin](./packages/graphql/README.md) for full documentation.

## JSON Output

All governance CLIs support a `--json` flag for scripting and CI integration:

```bash
contentlayer3-postman status --json    # workspace + per-source sync state
contentlayer3-postman discover --json  # all sources with governance status
contentlayer3-postman pull <name> --json   # diff vs Postman spec
contentlayer3-postman sync --json      # drift check with structured output
contentlayer3 validate --json          # validation results per collection
contentlayer3 inspect --json           # schema fields per collection
contentlayer3-graphql validate --json  # GraphQL schema validation errors
```

Exit codes are preserved in `--json` mode so CI pipelines can use both structured output and error detection.

## MCP Server

`@contentlayer3/mcp` exposes contentlayer3 governance as an [MCP](https://modelcontextprotocol.io) server, enabling AI assistants (Claude, Cursor, etc.) to query and triage your content layer using natural language.

```bash
npm add -D @contentlayer3/mcp
```

Configure in your MCP client (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "contentlayer3": {
      "command": "contentlayer3-mcp"
    }
  }
}
```

### Available tools

| Tool                  | What it does                                                  |
| --------------------- | ------------------------------------------------------------- |
| `get-collection`      | Load a collection by name from `contentlayer3.mcp.json`       |
| `validate-collection` | Validate all items against the collection schema              |
| `get-schema`          | Return field names and types for a collection                 |
| `postman-status`      | Read sync state from `contentlayer3.lock`                     |
| `postman-diff`        | Fetch the latest diff for a governed collection               |
| `graphql-validate`    | Validate the GraphQL schema from `contentlayer3.graphql.json` |

Create a `contentlayer3.mcp.json` sidecar in your project root to configure collections:

```json
{
  "collections": [
    {
      "name": "posts",
      "fields": {
        "title": "string",
        "date": "string",
        "excerpt": { "type": "string", "optional": true }
      }
    }
  ]
}
```

## Contentlayer3 Package Docs

- [Core / Next.js](./packages/contentlayer3/README.md): collection definition, validation, in-memory cache, Next.js integration, MDX, and filesystem source

**Docs for optional add-ons:**

- [Remote Source](./packages/source-remote/README.md): HTTP remote content source with offset/cursor pagination
- [Orama Search](./packages/search-orama/README.md): full-text search with Orama v3
- [Pagefind Search](./packages/search-pagefind/README.md): Pagefind manifest generation for static search
- [Developer Tools](./packages/devtools/README.md): CLI tools for `validate`, `inspect`, and `watch`
- [Postman Governance](./packages/postman/README.md): sync remote source schemas with Postman collections
- [GraphQL Plugin](./packages/graphql/README.md): expose collections via a type-safe GraphQL endpoint
- [MCP Server](./packages/mcp/README.md): AI-assisted governance, query collections, diff Postman specs, validate schemas
- [Migration Codemod](./tools/migrate/README.md): CLI to migrate existing Contentlayer v1/v2 projects to Contentlayer3

## Automatic Fields

Every document loaded from the filesystem source receives these fields automatically, no schema declaration needed:

| Field                 | Type     | Description                                                    |
| --------------------- | -------- | -------------------------------------------------------------- |
| `_filePath`           | `string` | Relative path from project root e.g. `content/posts/hello.mdx` |
| `_content`            | `string` | Raw body text with frontmatter stripped                        |
| `body.raw`            | `string` | Same as `_content`, provided for v1/v2 compatibility           |
| `_raw.sourceFilePath` | `string` | Same as `_filePath`                                            |
| `_raw.sourceFileName` | `string` | Basename e.g. `hello.mdx`                                      |
| `_raw.sourceFileDir`  | `string` | Directory portion e.g. `content/posts`                         |
| `_raw.flattenedPath`  | `string` | Path without extension e.g. `content/posts/hello`              |
| `_raw.contentType`    | `string` | `"md"`, `"mdx"`, or `"data"`                                   |

The `_raw` and `body.raw` shapes are intentionally compatible with Contentlayer v1/v2 so existing code continues to work without changes.

### Migrating from Contentlayer v1/v2

| v1/v2                                                                 | Contentlayer3                              |
| --------------------------------------------------------------------- | ------------------------------------------ |
| `doc._id`                                                             | `doc._filePath`                            |
| `doc._raw.flattenedPath`                                              | `doc._raw.flattenedPath` (same)            |
| `doc._raw.sourceFilePath`                                             | `doc._raw.sourceFilePath` (same)           |
| `doc.body.raw`                                                        | `doc.body.raw` (same), also `doc._content` |
| `doc.body.code`                                                       | `(await compileMDX(doc._content)).code`    |
| `defineDocumentType(() => ({ ... }))`                                 | `defineCollection({ ... })`                |
| `computedFields: { slug: { type: 'string', resolve: (doc) => ... } }` | `computedFields: { slug: (doc) => ... }`   |

## Migration from Contentlayer

Use the `contentlayer3-migrate` codemod to automate the majority of the migration:

```bash
npx contentlayer3-migrate check   # preview changes
npx contentlayer3-migrate run     # apply transforms and generate migration-report.md
```

See the [Migration Codemod docs](./tools/migrate/README.md) for the full list of transforms, field type mappings, and what requires manual review.

## Examples

- [Next.js App Router](./apps/example-nextjs)
- [Pages Router](./apps/example-pages)
- [Edge Runtime](./apps/example-cloudflare)

## License

MIT
