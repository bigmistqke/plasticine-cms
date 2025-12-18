import { For, Show, createSignal } from "solid-js";
import { useCMS } from "../store";

interface ItemListProps {
  collectionKey: string;
}

/**
 * List of items in a collection
 */
export function ItemList(props: ItemListProps) {
  const [state, actions] = useCMS();
  const [deleting, setDeleting] = createSignal<string | null>(null);

  const collectionState = () => state.collections[props.collectionKey];
  const items = () => collectionState()?.items || [];

  // Capitalize collection name for display
  const displayName = () =>
    props.collectionKey.charAt(0).toUpperCase() + props.collectionKey.slice(1);

  const getItemTitle = (data: Record<string, unknown>): string => {
    return (
      (data.title as string) ||
      (data.name as string) ||
      (data.slug as string) ||
      "Untitled"
    );
  };

  const handleDelete = async (id: string, sha: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    setDeleting(id);
    try {
      await actions.deleteItem(props.collectionKey, id, sha);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div class="item-list">
      <div class="item-list-header">
        <h2 class="item-list-title">{displayName()}</h2>
        <button
          class="btn btn-primary"
          onClick={() => actions.setCurrentItem("__new__")}
        >
          + New
        </button>
      </div>

      <Show when={collectionState()?.loading}>
        <div class="item-list-loading">Loading...</div>
      </Show>

      <Show when={collectionState()?.error}>
        <div class="item-list-error">{collectionState()?.error}</div>
      </Show>

      <Show when={!collectionState()?.loading && items().length === 0}>
        <div class="item-list-empty">
          No items yet. Create your first one!
        </div>
      </Show>

      <ul class="item-list-items">
        <For each={items()}>
          {(item) => (
            <li
              class="item-list-item"
              classList={{ active: state.currentItem === item.id }}
            >
              <div
                class="item-info"
                onClick={() => actions.setCurrentItem(item.id)}
              >
                <span class="item-title">{getItemTitle(item.data)}</span>
                <span class="item-id">{item.id}</span>
              </div>
              <button
                class="btn btn-danger btn-small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(item.id, item.sha);
                }}
                disabled={deleting() === item.id}
              >
                {deleting() === item.id ? "..." : "Delete"}
              </button>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}
