# @contentlayer3/graphql

GraphQL API plugin for [contentlayer3](../../README.md). Exposes your collections as a type-safe GraphQL endpoint in Next.js App Router with zero code-gen.

## How it works

Zod schemas from your `contentlayer3.config.ts` are automatically converted to GraphQL types at startup. The plugin builds a `graphql-js` schema, wires up list and single-item resolvers, and returns a standard Next.js route handler — no additional tooling required at runtime.

## Installation

```bash
pnpm add @contentlayer3/graphql
```

## Quick start

Create `app/api/graphql/route.ts`:

```typescript
import { withCollections } from '@contentlayer3/graphql'
import { getCollection } from 'contentlayer3'
import { posts, authors } from '../../../contentlayer3.config'

export const { GET, POST } = withCollections([
  { name: 'posts',   schema: posts.schema,   getItems: () => getCollection(posts) },
  { name: 'authors', schema: authors.schema, getItems: () => getCollection(authors) },
])
```

That's it. Your GraphQL endpoint is live at `/api/graphql`.

## API

### `withCollections(collections)`

Builds a GraphQL schema and returns a Next.js App Router route handler.

```typescript
import { withCollections } from '@contentlayer3/graphql'

export const { GET, POST } = withCollections([
  {
    name: 'posts',
    schema: posts.schema,           // z.ZodObject<...>
    getItems: () => getCollection(posts),  // () => Promise<unknown[]>
  },
])
```

Each collection gets two auto-generated query fields:

| Query | Arguments | Returns |
| ----- | --------- | ------- |
| `posts` | `limit: Int`, `offset: Int` | `[Post!]!` |
| `postsById` | `id: String!` | `Post` |

The `id` field must exist on the collection schema for `postsById` to return a result.

### `buildGraphQLSchema(collections)`

Build a `GraphQLSchema` directly without creating a route handler. Useful for testing or integrating with an existing GraphQL server.

```typescript
import { buildGraphQLSchema } from '@contentlayer3/graphql'

const schema = buildGraphQLSchema([{ name: 'posts', schema: posts.schema, getItems }])
```

### `executeGraphQL(schema, body)`

Execute a GraphQL operation against a schema, returning `{ data?, errors? }`.

```typescript
import { executeGraphQL, buildGraphQLSchema } from '@contentlayer3/graphql'

const schema = buildGraphQLSchema([...])
const result = await executeGraphQL(schema, { query: '{ posts { title } }' })
```

## Zod → GraphQL type mapping

| Zod type | GraphQL type |
| -------- | ------------ |
| `z.string()` | `String` |
| `z.number()` | `Float` |
| `z.number().int()` | `Int` |
| `z.boolean()` | `Boolean` |
| `z.array(z.string())` | `[String!]` |
| `z.enum([...])` | `<Name>Enum` |
| `z.object({...})` | Named `GraphQLObjectType` |
| `z.record(...)` | `JSON` scalar |
| `.optional()` / `.nullable()` | Strips `NonNull` wrapper |

Required fields are automatically wrapped in `GraphQLNonNull`. Optional and nullable fields are not.

## CLI

The `contentlayer3-graphql` CLI reads your sidecar config (see below) and operates on the generated schema.

### `generate`

Write `.contentlayer3/generated/schema.graphql` from your collections.

```bash
contentlayer3-graphql generate
```

### `print`

Print the GraphQL SDL to stdout.

```bash
contentlayer3-graphql print
```

### `validate`

Validate the schema for structural errors and exit non-zero if any are found. Useful in CI.

```bash
contentlayer3-graphql validate
```

## Sidecar config

Because the CLI cannot import your TypeScript config at runtime, you declare collections in a JSON sidecar file.

**`contentlayer3.graphql.json`**

```json
{
  "collections": [
    {
      "name": "posts",
      "fields": {
        "id":        "string",
        "title":     "string",
        "published": "boolean",
        "score":     { "type": "number", "optional": true }
      }
    }
  ]
}
```

Commit this file alongside `contentlayer3.config.ts`.

### Supported field types

| Value | GraphQL type |
| ----- | ------------ |
| `"string"` | `String` |
| `"number"` | `Float` |
| `"boolean"` | `Boolean` |
| `"string[]"` | `[String!]` |
| `"number[]"` | `[Float!]` |

Any field can be made optional:

```json
{ "type": "string", "optional": true }
```

## Generated files

| File | Description |
| ---- | ----------- |
| `.contentlayer3/generated/schema.graphql` | SDL file written by `generate` command |

## Edge compatibility

The core schema and handler are built on `graphql-js` and Web APIs (`Request`, `Response`). The `withCollections` and `buildGraphQLSchema` exports are edge-safe. The CLI commands (`generate`, `print`, `validate`) require Node.js and are not edge-safe.
