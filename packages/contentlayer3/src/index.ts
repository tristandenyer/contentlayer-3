// Core engine
export { defineCollection } from './collection.js'
export { getCollectionBase, getCollectionItemBase } from './get-collection.js'
export { CL3ValidationError, CL3SourceError } from './errors.js'
export { createMemoryCache } from './cache.js'
export type { CollectionSource, CollectionConfig, Collection, CL3Cache } from './types.js'

// Next.js adapter (primary getCollection)
export { getCollection, getCollectionItem, createNextCache } from './next-cache.js'
export { revalidateCollection, cl3Tags } from './next-revalidate.js'
export { getCollectionPages, getCollectionItemPages } from './next-pages.js'

// MDX (also exposed via ./mdx subpath)
export { compileMDX, withMDX } from './mdx-entry.js'
export type { MDXOptions, MDXResult, TocEntry } from './mdx-types.js'

// Filesystem source (also exposed via ./source-files subpath)
export { filesystem } from './filesystem.js'
export type { FilesystemSourceOptions } from './filesystem.js'
