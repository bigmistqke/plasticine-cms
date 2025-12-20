import { For, Show, createSignal } from 'solid-js'
import { type MediaFile } from '../backend/types'
import { useCMS } from './context'

/**
 * Media library for viewing and managing uploaded files
 * Data is already loaded on authentication, no lazy loading needed
 */
export function MediaLibrary() {
  const [state, actions] = useCMS()
  const [deleting, setDeleting] = createSignal<string | null>(null)

  const isImage = (name: string) => {
    return /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(name)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleDelete = async (file: MediaFile) => {
    const references = actions.getMediaReferences(file.url)
    const refCount = references.length

    const message =
      refCount > 0
        ? `This will delete the file and remove ${refCount} reference${refCount > 1 ? 's' : ''} from your content. Continue?`
        : 'Delete this file?'

    if (!confirm(message)) return

    setDeleting(file.path)
    try {
      await actions.deleteMedia(file.url, file.path, file.sha)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div class="media-library">
      <div class="media-library-header">
        <h2 class="media-library-title">Media Library</h2>
      </div>

      <Show when={state.media.loading}>
        <div class="media-library-loading">Loading media...</div>
      </Show>

      <Show when={state.media.error}>
        <div class="media-library-error">{state.media.error}</div>
      </Show>

      <Show when={!state.media.loading && state.media.files.length === 0}>
        <div class="media-library-empty">
          No media files yet. Upload files through content fields.
        </div>
      </Show>

      <div class="media-grid">
        <For each={state.media.files}>
          {file => {
            const references = () => actions.getMediaReferences(file.url)

            return (
              <div class="media-item" classList={{ deleting: deleting() === file.path }}>
                <div class="media-preview">
                  <Show
                    when={isImage(file.name)}
                    fallback={
                      <div class="media-file-icon">
                        <span class="media-file-ext">
                          {file.name.split('.').pop()?.toUpperCase()}
                        </span>
                      </div>
                    }
                  >
                    <img src={file.url} alt={file.name} loading="lazy" />
                  </Show>
                </div>

                <div class="media-info">
                  <span class="media-name" title={file.name}>
                    {file.name}
                  </span>
                  <span class="media-meta">
                    {formatSize(file.size)}
                    <Show when={references().length > 0}>
                      {' · '}
                      {references().length} ref
                      {references().length > 1 ? 's' : ''}
                    </Show>
                  </span>
                </div>

                <button
                  class="media-delete btn btn-danger btn-small"
                  onClick={() => handleDelete(file)}
                  disabled={deleting() === file.path}
                  title="Delete file"
                >
                  {deleting() === file.path ? '...' : '×'}
                </button>
              </div>
            )
          }}
        </For>
      </div>
    </div>
  )
}
