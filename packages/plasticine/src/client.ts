import type * as v from 'valibot'
import type { CollectionsConfig, PlasticineConfig, VersionedSchemaBase } from './config/define-config'

/**
 * Extract the output type from a VersionedSchema
 */
type InferVersionedOutput<T extends VersionedSchemaBase> = v.InferOutput<T['schema']>

/**
 * Content fetcher interface - abstraction for fetching raw content
 */
export interface ContentFetcher {
  /** List all items in a collection */
  listItems(collection: string): Promise<string[]>

  /** Get raw content for a specific item */
  getItem(collection: string, id: string): Promise<unknown>

  /** Check if an item exists */
  hasItem(collection: string, id: string): Promise<boolean>
}

/**
 * GitHub client configuration
 */
export interface GitHubClientOptions {
  owner: string
  repo: string
  branch?: string
  /** Path to content directory (default: 'content') */
  contentPath?: string
}

function createGitHubFetcher(options: GitHubClientOptions): ContentFetcher {
  const { owner, repo, branch = 'main', contentPath = 'content' } = options

  const baseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${contentPath}`
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${contentPath}`

  return {
    async listItems(collection: string): Promise<string[]> {
      const response = await fetch(`${apiUrl}/${collection}?ref=${branch}`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          return []
        }
        throw new Error(`Failed to list items: ${response.statusText}`)
      }

      const files = (await response.json()) as Array<{ name: string; type: string }>
      return files
        .filter((f) => f.type === 'file' && f.name.endsWith('.json'))
        .map((f) => f.name.replace(/\.json$/, ''))
    },

    async getItem(collection: string, id: string): Promise<unknown> {
      const response = await fetch(`${baseUrl}/${collection}/${id}.json`)

      if (!response.ok) {
        throw new Error(`Failed to get item ${collection}/${id}: ${response.statusText}`)
      }

      return response.json()
    },

    async hasItem(collection: string, id: string): Promise<boolean> {
      const response = await fetch(`${baseUrl}/${collection}/${id}.json`, {
        method: 'HEAD',
      })
      return response.ok
    },
  }
}

/**
 * Create a type-safe GitHub content client
 *
 * @example
 * ```ts
 * import { createGitHubClient } from '@plasticine/core'
 * import config from './plasticine/config'
 *
 * const content = createGitHubClient(config, {
 *   owner: 'myuser',
 *   repo: 'my-site',
 * })
 *
 * // Fully typed!
 * const authors = await content.authors.getAll()
 * const author = await content.authors.get('john-doe')
 * ```
 */
export function createGitHubClient<TCollections extends CollectionsConfig>(
  config: PlasticineConfig<TCollections>,
  options: GitHubClientOptions,
): PlasticineClient<TCollections> {
  return createClient(config, createGitHubFetcher(options))
}

/**
 * Collection accessor with typed methods
 */
export interface CollectionAccessor<TOutput> {
  /** List all item IDs in this collection */
  list(): Promise<string[]>

  /** Get a single item by ID */
  get(id: string): Promise<TOutput>

  /** Get all items in this collection */
  getAll(): Promise<Array<{ id: string; data: TOutput }>>

  /** Check if an item exists */
  has(id: string): Promise<boolean>
}

/**
 * Client type - provides typed access to all collections
 */
export type PlasticineClient<TCollections extends CollectionsConfig> = {
  [K in keyof TCollections & string]: CollectionAccessor<InferVersionedOutput<TCollections[K]>>
}

/**
 * Create a type-safe content client with a custom fetcher
 *
 * @example
 * ```ts
 * import { createClient, ContentFetcher } from '@plasticine/core'
 * import config from './plasticine/config'
 *
 * const myFetcher: ContentFetcher = {
 *   listItems: (collection) => fetch(`/api/${collection}`).then(r => r.json()),
 *   getItem: (collection, id) => fetch(`/api/${collection}/${id}`).then(r => r.json()),
 *   hasItem: (collection, id) => fetch(`/api/${collection}/${id}`, { method: 'HEAD' }).then(r => r.ok),
 * }
 *
 * const content = createClient(config, myFetcher)
 * ```
 */
export function createClient<TCollections extends CollectionsConfig>(
  config: PlasticineConfig<TCollections>,
  fetcher: ContentFetcher,
): PlasticineClient<TCollections> {
  const collections = config.getCollections()

  const client = {} as PlasticineClient<TCollections>

  for (const name of collections) {
    const accessor: CollectionAccessor<unknown> = {
      async list() {
        return fetcher.listItems(name)
      },

      async get(id: string) {
        const raw = await fetcher.getItem(name, id)
        return config.parseCollection(name, raw)
      },

      async getAll() {
        const ids = await fetcher.listItems(name)
        const items = await Promise.all(
          ids.map(async (id) => {
            const raw = await fetcher.getItem(name, id)
            const data = config.parseCollection(name, raw)
            return { id, data }
          }),
        )
        return items
      },

      async has(id: string) {
        return fetcher.hasItem(name, id)
      },
    }

    ;(client as Record<string, CollectionAccessor<unknown>>)[name] = accessor
  }

  return client
}
