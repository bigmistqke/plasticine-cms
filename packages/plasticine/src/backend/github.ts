import type {
  Backend,
  ConfigBackend,
  ContentBackend,
  ContentItem,
  MediaBackend,
  MediaFile,
} from './types'

const GITHUB_API = 'https://api.github.com'

export interface GitHubConfig {
  owner: string
  repo: string
  branch?: string
  contentPath?: string
}

export interface GitHubFile {
  name: string
  path: string
  sha: string
  size: number
  type: 'file' | 'dir'
  download_url: string | null
}

export interface GitHubContent {
  content: string
  encoding: string
  sha: string
  path: string
}

/**
 * GitHub API client for content management
 */
export class GitHubClient {
  private token: string
  private config: GitHubConfig

  constructor(token: string, config: GitHubConfig) {
    this.token = token
    this.config = {
      branch: 'main',
      contentPath: 'content',
      ...config,
    }
  }

  private get headers() {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    }
  }

  private buildPath(collection: string, filename?: string): string {
    const parts = [this.config.contentPath, collection]
    if (filename) {
      parts.push(filename)
    }
    return parts.filter(Boolean).join('/')
  }

  /**
   * List files in a collection
   */
  async listCollection(collection: string): Promise<GitHubFile[]> {
    return this.listFolder(this.buildPath(collection))
  }

  /**
   * List files in any folder path (relative to repo root)
   * Optionally recurses into subdirectories
   */
  async listFolder(folderPath: string, recursive = false): Promise<GitHubFile[]> {
    const url = `${GITHUB_API}/repos/${this.config.owner}/${this.config.repo}/contents/${folderPath}?ref=${this.config.branch}`

    const response = await fetch(url, { headers: this.headers })

    if (response.status === 404) {
      return []
    }

    if (!response.ok) {
      throw new Error(`Failed to list folder: ${response.statusText}`)
    }

    const data = await response.json()
    const files: GitHubFile[] = Array.isArray(data) ? data : []

    if (recursive) {
      const dirs = files.filter(f => f.type === 'dir')
      for (const dir of dirs) {
        const subFiles = await this.listFolder(dir.path, true)
        files.push(...subFiles)
      }
    }

    return files
  }

  /**
   * Get a single file's content
   */
  async getFile(collection: string, filename: string): Promise<GitHubContent> {
    const path = this.buildPath(collection, filename)
    const url = `${GITHUB_API}/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`

    const response = await fetch(url, { headers: this.headers })

    if (!response.ok) {
      throw new Error(`Failed to get file: ${response.statusText}`)
    }

    return response.json()
  }

  /**
   * Get and parse JSON content
   */
  async getJSON<T>(collection: string, filename: string): Promise<{ data: T; sha: string }> {
    const content = await this.getFile(collection, filename)
    const decoded = atob(content.content)
    return {
      data: JSON.parse(decoded) as T,
      sha: content.sha,
    }
  }

  /**
   * Create or update a file
   */
  async saveFile(
    collection: string,
    filename: string,
    content: string,
    message: string,
    sha?: string,
  ): Promise<{ sha: string }> {
    const path = this.buildPath(collection, filename)
    const url = `${GITHUB_API}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`

    // Retry logic for 409 conflicts
    const maxRetries = 3
    let currentSha = sha
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        // Wait briefly before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))

        // If we have a SHA conflict, try to fetch the current SHA
        if (currentSha) {
          try {
            const current = await this.getFile(collection, filename)
            currentSha = current.sha
          } catch {
            // File might not exist, continue without SHA
            currentSha = undefined
          }
        }
      }

      const body: Record<string, string> = {
        message,
        content: btoa(content),
        branch: this.config.branch!,
      }

      if (currentSha) {
        body.sha = currentSha
      }

      const response = await fetch(url, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify(body),
      })

      if (response.ok) {
        const data = await response.json()
        return { sha: data.content.sha }
      }

      const error = await response.json()

      // Retry on 409 conflict
      if (response.status === 409 && attempt < maxRetries - 1) {
        lastError = new Error(error.message || response.statusText)
        continue
      }

      throw new Error(`Failed to save file: ${error.message || response.statusText}`)
    }

    throw lastError || new Error('Failed to save file after retries')
  }

  /**
   * Save JSON content
   */
  async saveJSON<T>(
    collection: string,
    filename: string,
    data: T,
    message: string,
    sha?: string,
  ): Promise<{ sha: string }> {
    const content = JSON.stringify(data, null, 2)
    return this.saveFile(collection, filename, content, message, sha)
  }

  /**
   * Upload a binary file (image, etc.)
   * Returns the raw GitHub URL for the uploaded file
   */
  async uploadFile(file: File, folder: string = 'uploads'): Promise<{ url: string; sha: string }> {
    // Generate unique filename
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filename = `${timestamp}-${safeName}`
    const path = `${this.config.contentPath}/${folder}/${filename}`

    // Convert file to base64
    const base64 = await this.fileToBase64(file)

    const url = `${GITHUB_API}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`

    // Retry logic for 409 conflicts (branch was updated by concurrent operation)
    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        // Wait briefly before retry to let GitHub settle
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
      }

      const response = await fetch(url, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify({
          message: `cms: Upload ${file.name}`,
          content: base64,
          branch: this.config.branch,
        }),
      })

      if (response.ok) {
        const data = await response.json()

        // Return raw GitHub URL for the file
        const rawUrl = `https://raw.githubusercontent.com/${this.config.owner}/${this.config.repo}/${this.config.branch}/${path}`

        return { url: rawUrl, sha: data.content.sha }
      }

      const error = await response.json()

      // Retry on 409 conflict (branch state changed)
      if (response.status === 409 && attempt < maxRetries - 1) {
        lastError = new Error(error.message || response.statusText)
        continue
      }

      throw new Error(`Failed to upload file: ${error.message || response.statusText}`)
    }

    throw lastError || new Error('Failed to upload file after retries')
  }

  /**
   * Convert File to base64 string (without data URL prefix)
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Remove data URL prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  /**
   * Delete a file in a collection
   */
  async deleteFile(
    collection: string,
    filename: string,
    message: string,
    sha: string,
  ): Promise<void> {
    const path = this.buildPath(collection, filename)
    await this.deleteFileByPath(path, message, sha)
  }

  /**
   * Delete a file by its full path
   */
  async deleteFileByPath(path: string, message: string, sha: string): Promise<void> {
    const url = `${GITHUB_API}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`

    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.headers,
      body: JSON.stringify({
        message,
        sha,
        branch: this.config.branch,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Failed to delete file: ${error.message || response.statusText}`)
    }
  }

  /**
   * Check if content directory exists, create if not
   */
  async ensureContentDirectory(): Promise<void> {
    const url = `${GITHUB_API}/repos/${this.config.owner}/${this.config.repo}/contents/${this.config.contentPath}?ref=${this.config.branch}`

    const response = await fetch(url, { headers: this.headers })

    if (response.status === 404) {
      // Create a .gitkeep file to initialize the directory
      await this.saveFile('', '.gitkeep', '', 'Initialize content directory')
    }
  }
}

/**
 * Create a GitHub backend for Plasticine.
 * Returns { content, media } that both use the same GitHubClient.
 */

export interface GitHubBackendConfig extends GitHubConfig {
  token: string
}

/**
 * GitHub backend factory - creates backend after authentication.
 * Use this with CMS component.
 */
export function createGithubBackend(config: GitHubConfig) {
  function create(config: GitHubBackendConfig): Backend {
    const client = new GitHubClient(config.token, config)
    const branch = config.branch || 'main'
    const contentPath = config.contentPath || 'content'

    const content: ContentBackend = {
      async listCollection(collection: string): Promise<ContentItem[]> {
        const files = await client.listCollection(collection)
        const items: ContentItem[] = []

        for (const file of files) {
          if (file.type === 'file' && file.name.endsWith('.json')) {
            try {
              const { data, sha } = await client.getJSON(collection, file.name)
              items.push({
                id: file.name.replace('.json', ''),
                sha,
                data: data as Record<string, unknown>,
              })
            } catch (e) {
              console.error(`Failed to load ${file.name}:`, e)
            }
          }
        }

        return items
      },

      async getItem(collection: string, id: string): Promise<ContentItem> {
        const { data, sha } = await client.getJSON(collection, `${id}.json`)
        return { id, sha, data: data as Record<string, unknown> }
      },

      async saveItem(
        collection: string,
        id: string,
        data: Record<string, unknown>,
        sha?: string,
      ): Promise<{ sha?: string }> {
        const filename = `${id}.json`
        const message = sha
          ? `cms: Update ${collection}/${filename}`
          : `cms: Create ${collection}/${filename}`
        return client.saveJSON(collection, filename, data, message, sha)
      },

      async deleteItem(collection: string, id: string, sha?: string): Promise<void> {
        const filename = `${id}.json`
        const message = `cms: Delete ${collection}/${filename}`
        await client.deleteFile(collection, filename, message, sha!)
      },
    }

    const media: MediaBackend = {
      async listMedia(): Promise<MediaFile[]> {
        const uploadsPath = `${contentPath}/uploads`
        const files = await client.listFolder(uploadsPath, true)

        return files
          .filter(f => f.type === 'file')
          .map(f => ({
            name: f.name,
            path: f.path,
            sha: f.sha,
            size: f.size,
            url: `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${branch}/${f.path}`,
          }))
      },

      async uploadFile(file: File, folder?: string): Promise<{ url: string; sha?: string }> {
        const uploadPath = folder ? `uploads/${folder}` : 'uploads'
        return client.uploadFile(file, uploadPath)
      },

      async deleteFile(path: string, sha?: string): Promise<void> {
        await client.deleteFileByPath(path, `cms: Delete media ${path}`, sha!)
      },
    }

    const configBackend: ConfigBackend = {
      async readFile(path: string) {
        const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}?ref=${branch}`
        const response = await fetch(url, {
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${config.token}`,
          },
        })
        if (!response.ok) {
          throw new Error(`Failed to read file: ${response.statusText}`)
        }
        const data = await response.json()
        return {
          content: atob(data.content),
          sha: data.sha,
        }
      },

      async writeFile(path: string, content: string, sha?: string) {
        const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`
        const response = await fetch(url, {
          method: 'PUT',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${config.token}`,
          },
          body: JSON.stringify({
            message: `cms: Update ${path}`,
            content: btoa(content),
            branch,
            ...(sha ? { sha } : {}),
          }),
        })
        if (!response.ok) {
          const error = await response.json()
          throw new Error(`Failed to write file: ${error.message || response.statusText}`)
        }
        const data = await response.json()
        return { sha: data.content.sha }
      },
    }

    return { content, media, config: configBackend }
  }

  return {
    config,
    createBackend: (token: string) => create({ ...config, token }),
  }
}
