import * as v from 'valibot'
import { VersionedSchema } from './schema'

export type CollectionsConfig = Record<string, VersionedSchema<any[], v.GenericSchema>>

export interface PlasticineConfig<TCollections extends CollectionsConfig = CollectionsConfig> {
  /** The raw collections config (for type inference) */
  readonly collections: TCollections

  /** Parse content data for a collection, migrating if needed */
  parseCollection<K extends keyof TCollections & string>(
    collection: K,
    data: unknown,
  ): v.InferOutput<TCollections[K]['schema']>

  /** Get current schema for a collection */
  getSchema<K extends keyof TCollections & string>(
    collection: K,
  ): TCollections[K]['schema']

  /** Get all collection names */
  getCollections(): Array<keyof TCollections & string>
}

/**
 * Define a CMS config
 * Accepts an object where keys are collection names and values are VersionedSchema objects
 */
export function defineConfig<TCollections extends CollectionsConfig>(
  collections: TCollections,
): PlasticineConfig<TCollections> {
  return {
    collections,

    parseCollection(collection, data) {
      const versionedSchema = collections[collection]
      if (!versionedSchema) {
        throw new Error(`Unknown collection: ${String(collection)}`)
      }
      return versionedSchema.parse(data)
    },

    getSchema(collection) {
      return collections[collection]?.schema
    },

    getCollections() {
      return Object.keys(collections) as Array<keyof TCollections & string>
    },
  }
}
