import { For } from "solid-js";
import { useCMS, type CollectionConfig } from "../store";

interface CollectionListProps {
  collections: Record<string, CollectionConfig>;
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

  return (
    <nav class="collection-list">
      <h2 class="collection-list-title">Collections</h2>
      <ul class="collection-list-items">
        <For each={Object.entries(props.collections)}>
          {([name, config]) => (
            <li
              class="collection-list-item"
              classList={{ active: state.currentCollection === name }}
              onClick={() => handleSelect(name)}
            >
              <span class="collection-name">{config.name}</span>
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
