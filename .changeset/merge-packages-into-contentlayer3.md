---
"contentlayer3": major
---

BREAKING: `@cl3/core`, `@cl3/next`, `@cl3/mdx`, and `@cl3/source-filesystem` have been merged into a single package: `contentlayer3`.

**Before:**

```bash
npm install @cl3/core @cl3/next @cl3/source-filesystem zod
```

```ts
import { defineCollection } from '@cl3/core'
import { getCollection, revalidateCollection } from '@cl3/next'
import { filesystem } from '@cl3/source-filesystem'
import { withMDX } from '@cl3/mdx'
```

**After:**

```bash
npm install contentlayer3 zod
```

```ts
import { defineCollection, getCollection, revalidateCollection } from 'contentlayer3'
import { filesystem } from 'contentlayer3/source-files'
import { withMDX } from 'contentlayer3/mdx'
```

`@contentlayer3/source-remote`, `@contentlayer3/search-orama`, `@contentlayer3/search-pagefind`, and `@contentlayer3/devtools` are unchanged.
