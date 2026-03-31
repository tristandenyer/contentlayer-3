// Pages Router support
// unstable_cache is not available in Pages Router context.
// Falls back to @cl3/core's in-memory cache.
// Revalidation is handled via revalidatePath or ISR revalidate interval in getStaticProps.
export { getCollection, getCollectionItem } from '@cl3/core'
