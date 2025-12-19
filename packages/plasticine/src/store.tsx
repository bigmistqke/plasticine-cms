import { createStore, produce } from 'solid-js/store'
import { tokenStorage } from './backend/github'
import type { Backend, BackendFactory, ContentItem, MediaFile } from './backend/types'
import type { PlasticineConfig } from './config/define-config'
import { getSchemaEntries, getSchemaMetadata } from './config/schema'

export interface CMSProps {
  config: PlasticineConfig
  backend: BackendFactory
  schemaPath?: string
}
export interface CollectionState {
  items: Array<ContentItem & { filename: string }>
  loading: boolean
  error: string | null
}

export interface MediaState {
  files: MediaFile[]
  loading: boolean
  error: string | null
}

export interface SchemaState {
  content: string
  sha: string | null
  loading: boolean
  saving: boolean
  error: string | null
}

export interface CMSState {
  // Auth
  authenticated: boolean
  user: { login: string; avatar_url: string; name: string } | null
  authLoading: boolean
  authError: string | null

  // Data loading (all collections + media)
  dataLoading: boolean
  dataError: string | null

  // Collections
  collections: Record<string, CollectionState>

  // Media
  media: MediaState

  // Schema
  schema: SchemaState

  // Navigation
  currentView: 'collections' | 'media' | 'schema'
  currentCollection: string | null
  currentItem: string | null
}

export interface CMSActions {
  // Auth
  loginWithToken(token: string): Promise<void>
  logout(): void

  // Data
  loadAllData(): Promise<void>

  // Collections
  saveItem(collection: string, data: Record<string, unknown>, existingSha?: string): Promise<void>
  deleteItem(collection: string, id: string, sha?: string): Promise<void>

  // Files
  uploadFile(file: File, fieldPath?: string): Promise<string>

  // Media
  deleteMedia(url: string, path: string, sha?: string): Promise<void>
  getMediaReferences(url: string): Array<{ collection: string; id: string; field: string }>

  // Schema
  loadSchema(): Promise<void>
  saveSchema(content: string): Promise<void>

  // Navigation
  setCurrentView(view: 'collections' | 'media' | 'schema'): void
  setCurrentCollection(name: string | null): void
  setCurrentItem(id: string | null): void
}

export type CMSStore = [CMSState, CMSActions]

/**********************************************************************************/
/*                                                                                */
/*                                Create CMS Store                                */
/*                                                                                */
/**********************************************************************************/

export function createCMSStore(props: CMSProps): CMSStore {
  const { config, backend: backendFactory, schemaPath = 'plasticine/config.ts' } = props
  let backend: Backend | null = null

  const collectionNames = config.getCollections()

  const [state, setState] = createStore<CMSState>({
    authenticated: false,
    user: null,
    authLoading: false,
    authError: null,
    dataLoading: false,
    dataError: null,
    collections: Object.fromEntries(
      collectionNames.map(name => [name, { items: [], loading: false, error: null }]),
    ),
    media: { files: [], loading: false, error: null },
    schema: {
      content: '',
      sha: null,
      loading: false,
      saving: false,
      error: null,
    },
    currentView: 'collections',
    currentCollection: null,
    currentItem: null,
  })

  /**
   * Get media field names from a schema (fields with ui: "image" or "file")
   */
  const getMediaFields = (collectionName: string): string[] => {
    const schema = config.getSchema(collectionName)
    if (!schema) return []

    const entries = getSchemaEntries(schema)
    if (!entries) return []

    return Object.entries(entries)
      .filter(([_, fieldSchema]) => {
        const meta = getSchemaMetadata(fieldSchema)
        return meta.ui === 'image' || meta.ui === 'file'
      })
      .map(([key]) => key)
  }

  const getId = (data: Record<string, unknown>): string => {
    // Use slug field if present, otherwise fallback to timestamp
    const value = data.slug ?? data.id
    if (typeof value === 'string' && value) {
      return value
    }
    return Date.now().toString()
  }

  /**
   * Load a single collection's items
   */
  const loadCollection = async (
    name: string,
  ): Promise<Array<ContentItem & { filename: string }>> => {
    if (!backend) throw new Error('Not authenticated')

    const schema = config.getSchema(name)
    if (!schema) throw new Error(`Unknown collection: ${name}`)

    const items = await backend.content.listCollection(name)

    return items.map(item => {
      // Parse through versioned config (auto-migrates)
      const parsed = config.parseCollection(name, item.data) as Record<string, unknown>
      return {
        ...item,
        filename: `${item.id}.json`,
        data: parsed,
      }
    })
  }

  const actions: CMSActions = {
    async loginWithToken(token: string) {
      setState('authLoading', true)
      setState('authError', null)

      try {
        const user = await backendFactory.getUser(token)
        backend = backendFactory.createBackend(token)

        tokenStorage.set(token)
        setState(
          produce(s => {
            s.authenticated = true
            s.user = user
            s.authLoading = false
          }),
        )

        // Load all data after authentication
        await actions.loadAllData()
      } catch (error) {
        setState(
          produce(s => {
            s.authLoading = false
            s.authError = error instanceof Error ? error.message : 'Authentication failed'
          }),
        )
        throw error
      }
    },

    logout() {
      tokenStorage.remove()
      backend = null
      setState(
        produce(s => {
          s.authenticated = false
          s.user = null
          s.dataLoading = false
          s.dataError = null
          // Reset collections
          for (const name of collectionNames) {
            s.collections[name] = { items: [], loading: false, error: null }
          }
          s.media = { files: [], loading: false, error: null }
        }),
      )
    },

    async loadAllData() {
      if (!backend) throw new Error('Not authenticated')

      setState('dataLoading', true)
      setState('dataError', null)

      try {
        // Load all collections and media in parallel
        const [collectionsData, mediaData] = await Promise.all([
          Promise.all(
            collectionNames.map(async name => ({
              name,
              items: await loadCollection(name),
            })),
          ),
          backend.media.listMedia(),
        ])

        // Update state with all data
        setState(
          produce(s => {
            for (const { name, items } of collectionsData) {
              s.collections[name].items = items
            }
            s.media.files = mediaData
            s.dataLoading = false
          }),
        )
      } catch (error) {
        setState(
          produce(s => {
            s.dataLoading = false
            s.dataError = error instanceof Error ? error.message : 'Failed to load data'
          }),
        )
        throw error
      }
    },

    async saveItem(collection: string, data: Record<string, unknown>, existingSha?: string) {
      if (!backend) throw new Error('Not authenticated')

      const schema = config.getSchema(collection)
      if (!schema) throw new Error(`Unknown collection: ${collection}`)

      // Validate data against current schema
      const parsed = config.parseCollection(collection, data) as Record<string, unknown>
      const id = getId(parsed)

      const { sha } = await backend.content.saveItem(collection, id, parsed, existingSha)

      // Update local state
      setState(
        'collections',
        collection,
        'items',
        produce(items => {
          const index = items.findIndex(item => item.id === id)
          const newItem = { id, filename: `${id}.json`, sha, data: parsed }
          if (index >= 0) {
            items[index] = newItem
          } else {
            items.push(newItem)
          }
        }),
      )
    },

    async deleteItem(collection: string, id: string, sha?: string) {
      if (!backend) throw new Error('Not authenticated')

      await backend.content.deleteItem(collection, id, sha)

      setState(
        'collections',
        collection,
        'items',
        produce(items => {
          const index = items.findIndex(item => item.id === id)
          if (index >= 0) {
            items.splice(index, 1)
          }
        }),
      )
    },

    async uploadFile(file: File, fieldPath?: string): Promise<string> {
      if (!backend) throw new Error('Not authenticated')

      const { url, sha } = await backend.media.uploadFile(file, fieldPath)

      // Add to media state immediately
      const filename = url.split('/').pop() || ''
      setState(
        'media',
        'files',
        produce(files => {
          files.push({
            name: filename,
            path: filename, // Backend-specific path handling
            sha,
            size: file.size,
            url,
          })
        }),
      )

      return url
    },

    getMediaReferences(url: string): Array<{ collection: string; id: string; field: string }> {
      const references: Array<{
        collection: string
        id: string
        field: string
      }> = []

      for (const collectionName of collectionNames) {
        const mediaFields = getMediaFields(collectionName)
        const items = state.collections[collectionName]?.items || []

        for (const item of items) {
          for (const field of mediaFields) {
            if (item.data[field] === url) {
              references.push({
                collection: collectionName,
                id: item.id,
                field,
              })
            }
          }
        }
      }

      return references
    },

    async deleteMedia(url: string, path: string, sha?: string): Promise<void> {
      if (!backend) throw new Error('Not authenticated')

      // Find and update all references (collections are already loaded)
      const references = actions.getMediaReferences(url)

      for (const ref of references) {
        const item = state.collections[ref.collection]?.items.find(i => i.id === ref.id)
        if (!item) continue

        // Create updated data with field set to undefined
        const updatedData = { ...item.data, [ref.field]: undefined }

        // Save the updated item
        await actions.saveItem(ref.collection, updatedData, item.sha)
      }

      // Delete the media file
      await backend.media.deleteFile(path, sha)

      // Remove from local state
      setState(
        'media',
        'files',
        produce(files => {
          const index = files.findIndex(f => f.path === path)
          if (index >= 0) {
            files.splice(index, 1)
          }
        }),
      )
    },

    async loadSchema() {
      if (!backend) throw new Error('Not authenticated')

      setState('schema', 'loading', true)
      setState('schema', 'error', null)

      try {
        const { content, sha } = await backend.config.readFile(schemaPath)
        setState(
          produce(s => {
            s.schema.content = content
            s.schema.sha = sha || null
            s.schema.loading = false
          }),
        )
      } catch (error) {
        setState(
          produce(s => {
            s.schema.loading = false
            s.schema.error = error instanceof Error ? error.message : 'Failed to load schema'
          }),
        )
        throw error
      }
    },

    async saveSchema(content: string) {
      if (!backend) throw new Error('Not authenticated')

      setState('schema', 'saving', true)
      setState('schema', 'error', null)

      try {
        const { sha } = await backend.config.writeFile(
          schemaPath,
          content,
          state.schema.sha || undefined,
        )
        setState(
          produce(s => {
            s.schema.content = content
            s.schema.sha = sha || null
            s.schema.saving = false
          }),
        )
      } catch (error) {
        setState(
          produce(s => {
            s.schema.saving = false
            s.schema.error = error instanceof Error ? error.message : 'Failed to save schema'
          }),
        )
        throw error
      }
    },

    setCurrentView(view: 'collections' | 'media' | 'schema') {
      setState('currentView', view)
      if (view === 'media' || view === 'schema') {
        setState('currentCollection', null)
        setState('currentItem', null)
      }
      if (view === 'schema' && !state.schema.content && !state.schema.loading) {
        actions.loadSchema()
      }
    },

    setCurrentCollection(name: string | null) {
      setState('currentView', 'collections')
      setState('currentCollection', name)
      setState('currentItem', null)
    },

    setCurrentItem(id: string | null) {
      setState('currentItem', id)
    },
  }

  // Try to restore session on init
  const savedToken = tokenStorage.get()
  if (savedToken) {
    actions.loginWithToken(savedToken).catch(() => {
      tokenStorage.remove()
    })
  }

  return [state, actions]
}
