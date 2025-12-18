import { For } from "solid-js";
import { useCMS } from "../store";

interface CollectionListProps {
  collections: string[];
}

/**
 * Sidebar list of available collections
 */
export function CollectionList(props: CollectionListProps) {
  const [state, actions] = useCMS();

  const handleSelect = async (name: string) => {
    actions.setCurrentCollection(name);
    await actions.loadCollection(name);
  };

  // Capitalize collection name for display
  const displayName = (name: string) =>
    name.charAt(0).toUpperCase() + name.slice(1);

  return (
    <nav class="collection-list">
      <h2 class="collection-list-title">Collections</h2>
      <ul class="collection-list-items">
        <For each={props.collections}>
          {(name) => (
            <li
              class="collection-list-item"
              classList={{ active: state.currentCollection === name }}
              onClick={() => handleSelect(name)}
            >
              <span class="collection-name">{displayName(name)}</span>
              <span class="collection-count">
                {state.collections[name]?.items.length || 0}
              </span>
            </li>
          )}
        </For>
      </ul>
    </nav>
  );
}
