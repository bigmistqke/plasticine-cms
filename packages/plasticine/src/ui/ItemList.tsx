import { useAction, useSubmission } from '@solidjs/router'
import { For, Show } from 'solid-js'
import { deleteItemAction } from './actions'
import { useCMS } from './context'
import { Link } from './Link'

interface ItemListProps {
  collectionKey: string
}

/**
 * List of items in a collection
 */
export function ItemList(props: ItemListProps) {
  const [state, actions] = useCMS()

  const deleteItem = useAction(deleteItemAction)
  const submission = useSubmission(deleteItemAction)

  const collectionState = () => state.collections[props.collectionKey]
  const items = () => collectionState()?.items || []

  // Capitalize collection name for display
  const displayName = () =>
    props.collectionKey.charAt(0).toUpperCase() + props.collectionKey.slice(1)

  const getItemTitle = (data: Record<string, unknown>): string => {
    return (data.title as string) || (data.name as string) || (data.slug as string) || 'Untitled'
  }

  const handleDelete = (id: string, sha?: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return
    deleteItem(props.collectionKey, id, sha, actions)
  }

  // Check if a specific item is being deleted
  const isDeletingItem = (id: string) => {
    if (!submission.pending) return false
    const input = submission.input
    return Array.isArray(input) && input[1] === id
  }

  return (
    <div class="item-list">
      <div class="item-list-header">
        <h2 class="item-list-title">{displayName()}</h2>
        <Link params={{ collection: props.collectionKey, item: '__new__' }} class="btn btn-primary">
          + New
        </Link>
      </div>

      <Show when={collectionState()?.loading}>
        <div class="item-list-loading">Loading...</div>
      </Show>

      <Show when={collectionState()?.error}>
        <div class="item-list-error">{collectionState()?.error}</div>
      </Show>

      <Show when={!collectionState()?.loading && items().length === 0}>
        <div class="item-list-empty">No items yet. Create your first one!</div>
      </Show>

      <ul class="item-list-items">
        <For each={items()}>
          {item => (
            <li class="item-list-item">
              <Link
                params={{ collection: props.collectionKey, item: item.id }}
                class="item-info"
                activeClass="active"
              >
                <span class="item-title">{getItemTitle(item.data)}</span>
                <span class="item-id">{item.id}</span>
              </Link>
              <button
                class="btn btn-danger btn-small"
                onClick={e => {
                  e.stopPropagation()
                  handleDelete(item.id, item.sha)
                }}
                disabled={isDeletingItem(item.id)}
              >
                {isDeletingItem(item.id) ? '...' : 'Delete'}
              </button>
            </li>
          )}
        </For>
      </ul>
    </div>
  )
}
