// Pages Router support — unstable_cache is not available in this context.
// Falls back to in-memory cache. Revalidation is handled via revalidatePath
// or the ISR revalidate interval in getStaticProps.
export { getCollectionBase as getCollectionPages, getCollectionItemBase as getCollectionItemPages } from './get-collection.js'
