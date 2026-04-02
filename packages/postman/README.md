# @contentlayer3/postman

Postman governance CLI for [contentlayer3](../../README.md). Keeps your remote source schemas in sync with Postman collections.

## How it works

When you use `remote()` sources in contentlayer3, their schemas live in two places: your codebase (as Zod schemas) and Postman (as collection definitions). This package bridges them with a governance workflow backed by a `contentlayer3.lock` file.

## Installation

```bash
pnpm add -D @contentlayer3/postman
```

Set your Postman API key:

```bash
export POSTMAN_API_KEY=your-key
```

## Sidecar config

Because `remote()` captures its endpoint in a closure, the CLI cannot introspect your config at runtime. You must declare your remote sources in a sidecar file alongside your config:

**`contentlayer3.postman.json`**
```json
{
  "sources": [
    { "name": "blog-posts", "endpoint": "https://api.example.com/posts" },
    { "name": "authors",    "endpoint": "https://api.example.com/authors" }
  ]
}
```

Commit this file alongside `contentlayer3.config.ts`.

## Commands

### `init`

First-time setup. Creates Postman collections for all remote sources and writes `contentlayer3.lock`.

```bash
contentlayer3-postman init
```

- Prompts for a Postman workspace (create new or use existing)
- Creates one Postman collection per remote source
- Generates `.contentlayer3/generated/<name>.schema.ts` for each source
- Writes `contentlayer3.lock`

### `status`

Show governance status for all sources.

```bash
contentlayer3-postman status
```

Statuses:
- `✓ in sync` — Postman spec matches the lock
- `⚠ DRIFTED` — Postman spec has changed since last sync
- `✗ FILE_EDITED` — generated schema was manually edited
- `○ UNREGISTERED` — source exists in config but has no Postman collection
- `– IGNORED` — source is explicitly excluded from governance

### `pull <name>`

Fetch the latest spec from Postman and stage it for review.

```bash
contentlayer3-postman pull blog-posts
```

- Compares current Postman spec hash against the lock
- If changed: writes `.contentlayer3/tmp/<name>.diff.json` and shows a field-level diff
- If unchanged: exits cleanly with "Already in sync"

### `apply <name>`

Promote a staged pull into the codebase.

```bash
contentlayer3-postman apply blog-posts
```

- Requires a pending `.contentlayer3/tmp/<name>.diff.json` from `pull`
- Warns on removed or changed fields
- Regenerates `.contentlayer3/generated/<name>.schema.ts`
- Updates `contentlayer3.lock` with new hashes and `origin: pulled`

### `push <name>`

Create a new Postman collection from a local source (opposite of `adopt`).

```bash
contentlayer3-postman push blog-posts
```

Use `--update` to push local schema changes to an existing governed collection:

```bash
contentlayer3-postman push blog-posts --update
```

### `adopt [name]`

Map an existing Postman collection to a local source (opposite of `push`).

```bash
contentlayer3-postman adopt blog-posts
```

- Lists all collections in the workspace
- Prompts you to pick which collection governs the source
- If a diff exists, lets you choose: accept Postman as truth, keep local schema, or flag for later review
- Writes `origin: adopted` to the lock

### `sync`

CI-friendly drift check. Exits non-zero if anything is out of sync.

```bash
contentlayer3-postman sync
```

Exit codes:
| Code | Meaning |
|------|---------|
| `0`  | All governed sources in sync |
| `1`  | One or more Postman specs have drifted |
| `2`  | One or more generated schema files were manually edited |
| `3`  | Unregistered sources exist (only when `CL3_POSTMAN_STRICT_UNREGISTERED=1`) |

Use in CI:

```yaml
- run: contentlayer3-postman sync --ci
  env:
    POSTMAN_API_KEY: ${{ secrets.POSTMAN_API_KEY }}
```

### `discover`

List all remote sources and their governance status in a table.

```bash
contentlayer3-postman discover
```

Useful for a quick overview before running `init`, `adopt`, or `push`.

### `ignore <name>`

Exclude a source from governance checks.

```bash
contentlayer3-postman ignore blog-posts
```

- If the source is currently governed, prompts for confirmation before removing it
- The Postman collection is **not** deleted
- To undo: remove the name from the `ignored` array in `contentlayer3.lock`

## Governance workflow

**New project:**
```
init → status → pull → apply → sync (in CI)
```

**Adopting an existing Postman workspace:**
```
discover → adopt → status → pull → apply
```

**Pushing local changes to Postman:**
```
push <name> --update
```

## Generated files

| File | Purpose |
|------|---------|
| `contentlayer3.lock` | Source of truth for governance state. Commit this. |
| `.contentlayer3/generated/<name>.schema.ts` | Generated Zod schema. Commit this. Do not edit manually. |
| `.contentlayer3/tmp/` | Staging area for pull/apply. Add to `.gitignore`. |

## Using generated schemas

After `init`, `pull`, or `apply`, use the generated schema in your config:

```typescript
import { fromPostman } from '@contentlayer3/postman'

export const blogPosts = defineCollection({
  name: 'blog-posts',
  source: remote({ endpoint: 'https://api.example.com/posts' }),
  schema: fromPostman('blog-posts').extend({
    // Add any local-only fields here
    featured: z.boolean().optional(),
  }),
})
```

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTMAN_API_KEY` | Yes | Postman API key from your account settings |
| `CL3_POSTMAN_STRICT_UNREGISTERED` | No | Set to `1` to make `sync` exit 3 when unregistered sources exist |
