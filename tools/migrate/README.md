# contentlayer3-migrate

Codemod CLI for migrating existing Contentlayer v1/v2 projects to Contentlayer3.

## Usage

```bash
npx contentlayer3-migrate check   # analyze your project, show what would change (no writes)
npx contentlayer3-migrate run     # apply all transforms and write a migration-report.md
npx contentlayer3-migrate run --dry-run
```

Run from the root of your project (the directory containing `contentlayer.config.ts`).

## What it transforms

### `contentlayer.config.ts`

Rewrites `defineDocumentType` blocks to `defineCollection` with a Zod schema:

```ts
// Before
const Post = defineDocumentType(() => ({
  name: 'Post',
  filePathPattern: 'posts/**/*.mdx',
  fields: {
    title: { type: 'string', required: true },
    date:  { type: 'date',   required: true },
    draft: { type: 'boolean' },
  },
}))

export default makeSource({ contentDirPath: 'content', documentTypes: [Post] })
```

```ts
// After
export const posts = defineCollection({
  name: 'posts',
  source: filesystem({ contentDir: 'content', pattern: 'posts/**/*.mdx' }),
  schema: z.object({
    _content:  z.string(),
    _filePath: z.string(),
    title: z.string(),
    date:  z.string(), // date fields are z.string() — parse with new Date() as needed
    draft: z.boolean().optional(),
  }),
})
```

Field type mappings:

| v1/v2 type | Zod equivalent |
| ---------- | -------------- |
| `string`   | `z.string()`   |
| `date`     | `z.string()`   |
| `boolean`  | `z.boolean()`  |
| `number`   | `z.number()`   |
| `json`     | `z.unknown()`  |
| `list`     | `z.array(z.string())` |
| `markdown` | `z.string()`   |
| `mdx`      | `z.string()`   |
| `image`    | `z.string()`   |
| `enum`     | `z.string()`   |

### `next.config.ts` / `next.config.js`

Removes the `withContentlayer` wrapper, which is not needed in CL3:

```ts
// Before
export default withContentlayer(nextConfig)

// After
export default nextConfig
```

### App/pages imports

Comments out `contentlayer/generated` and `contentlayer2/generated` imports and flags them for manual update:

```ts
// Before
import { allPosts } from 'contentlayer/generated'

// After
// Replace with: import { getCollection } from 'contentlayer3'
// See https://cl3.dev/migration for collection setup
// import { allPosts } from 'contentlayer/generated'
```

Removes `next-contentlayer` imports entirely (no replacement needed in CL3).

## What requires manual review

The codemod flags these in `migration-report.md` and marks them `requiresManualReview`:

- **`computedFields`**: the v1/v2 `{ type, resolve }` shape becomes a plain function in CL3. See [Computed Fields](../../README.md#computed-fields) for the new syntax.
- **`contentlayer/generated` imports**: each import of a generated collection type needs to be replaced with a `getCollection()` call.
- **Unknown field types**: any field type not in the mapping table above is replaced with `z.unknown()` and flagged.

## What does not need to change

- `doc._raw.flattenedPath`, `doc._raw.sourceFilePath`, `doc._raw.sourceFileName` — same shape
- `doc.body.raw` — still works, provided automatically alongside `doc._content`

## Commands

| Command | Description |
| ------- | ----------- |
| `check` | Dry run: analyze project, print changes and warnings, write nothing |
| `run` | Apply transforms, write modified files, generate `migration-report.md` |
| `run --dry-run` | Same as `check` |
| `shadow` | Coming soon: run CL3 and original contentlayer in parallel and diff the output |
