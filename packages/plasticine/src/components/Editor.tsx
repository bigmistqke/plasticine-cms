import { Show, createResource } from "solid-js";
import type * as v from "valibot";
import { useCMS } from "../store";
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

  // Load item data if editing existing
  const [itemData] = createResource(
    () => (isNew() ? null : { collection: props.collectionKey, id: props.itemId }),
    async (params) => {
      if (!params) return null;
      return actions.getItem(params.collection, params.id);
    }
  );

  const handleSubmit = async (data: Record<string, unknown>) => {
    const existingSha = isNew() ? undefined : itemData()?.sha;
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

      <Show when={itemData.loading}>
        <div class="editor-loading">Loading...</div>
      </Show>

      <Show when={itemData.error}>
        <div class="editor-error">
          Failed to load: {itemData.error?.message}
        </div>
      </Show>

      <Show when={isNew() || itemData()} keyed>
        {(data) => (
          <SchemaForm
            schema={props.schema}
            initialData={isNew() ? undefined : (data as any)?.data}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            submitLabel={isNew() ? "Create" : "Save"}
          />
        )}
      </Show>
    </div>
  );
}
