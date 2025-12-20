import { For } from 'solid-js'
import { useCMS } from '../context'
import { Link } from './Link'

interface CollectionListProps {
  collections: string[]
}

/**
 * Sidebar list of available collections
 * Data is already loaded on authentication
 */
export function CollectionList(props: CollectionListProps) {
  const [state] = useCMS()

  // Capitalize collection name for display
  const displayName = (name: string) => name.charAt(0).toUpperCase() + name.slice(1)

  return (
    <nav class="collection-list">
      <h2 class="collection-list-title">Collections</h2>
      <ul class="collection-list-items">
        <For each={props.collections}>
          {name => (
            <Link params={{ collection: name }} class="collection-list-item" activeClass="active">
              <span class="collection-name">{displayName(name)}</span>
              <span class="collection-count">{state.collections[name]?.items.length || 0}</span>
            </Link>
          )}
        </For>
      </ul>
    </nav>
  )
}
