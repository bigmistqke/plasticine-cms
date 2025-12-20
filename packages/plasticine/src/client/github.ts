import { CollectionsConfig, PlasticineConfig } from "../config/define-config"
import { ContentFetcher, PlasticineClient, createClient } from "./client"

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