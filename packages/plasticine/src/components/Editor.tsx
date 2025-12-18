import { Show } from "solid-js";
import type * as v from "valibot";
import { useCMS, type ContentItem } from "../store";
import { SchemaForm } from "./SchemaForm";

interface EditorProps {
  schema: v.GenericSchema;
  collectionKey: string;
  itemId: string;
}

/**
 * Editor for a single content item
 */
export function Editor(props: EditorProps) {
  const [state, actions] = useCMS();

  const isNew = () => props.itemId === "__new__";

  // Capitalize collection name for display
  const displayName = () =>
    props.collectionKey.charAt(0).toUpperCase() + props.collectionKey.slice(1);

  // Get item from already-loaded collection data
  const itemData = (): ContentItem | undefined => {
    if (isNew()) return undefined;
    const collection = state.collections[props.collectionKey];
    return collection?.items.find((item) => item.id === props.itemId);
  };

  const handleSubmit = async (data: Record<string, unknown>) => {
    const existingSha = itemData()?.sha;
    await actions.saveItem(props.collectionKey, data, existingSha);

    // If was new, switch to editing the created item
    if (isNew()) {
      // Use slug or id field for the filename
      const id = (data.slug ?? data.id) as string;
      if (id) {
        actions.setCurrentItem(id);
      }
    }
  };

  const handleCancel = () => {
    actions.setCurrentItem(null);
  };

  return (
    <div class="editor">
      <div class="editor-header">
        <h2 class="editor-title">
          {isNew() ? `New ${displayName()}` : `Edit ${displayName()}`}
        </h2>
      </div>

      <Show when={isNew() ? props.itemId : itemData()} keyed>
        {(data) => (
          <SchemaForm
            schema={props.schema}
            initialData={isNew() ? undefined : (data as ContentItem).data}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            submitLabel={isNew() ? "Create" : "Save"}
          />
        )}
      </Show>
    </div>
  );
}
