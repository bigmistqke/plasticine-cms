import { useAction, useNavigate, useSubmission } from '@solidjs/router'
import { Show } from 'solid-js'
import type * as v from 'valibot'
import { saveItemAction } from '../actions'
import { type ContentItem } from '../backend/types'
import { useCMS } from '../context'
import { SchemaForm } from './SchemaForm'

interface EditorProps {
  schema: v.GenericSchema
  collectionKey: string
  itemId: string
}

/**
 * Editor for a single content item
 */
export function Editor(props: EditorProps) {
  const [state, actions] = useCMS()
  const navigate = useNavigate()

  const saveItem = useAction(saveItemAction)
  const submission = useSubmission(saveItemAction)

  const isNew = () => props.itemId === '__new__'

  // Capitalize collection name for display
  const displayName = () =>
    props.collectionKey.charAt(0).toUpperCase() + props.collectionKey.slice(1)

  // Get item from already-loaded collection data
  const itemData = (): ContentItem | undefined => {
    if (isNew()) return undefined
    const collection = state.collections[props.collectionKey]
    return collection?.items.find(item => item.id === props.itemId)
  }

  const handleSubmit = async (data: Record<string, unknown>) => {
    const existingSha = itemData()?.sha
    await saveItem(props.collectionKey, data, existingSha, actions)

    // If was new, navigate to the created item
    if (isNew()) {
      // Use slug or id field for the filename
      const id = (data.slug ?? data.id) as string
      if (id) {
        navigate(`/collections/${props.collectionKey}/${id}`, {
          replace: true,
        })
      }
    }
  }

  const handleCancel = () => {
    navigate(`/collections/${props.collectionKey}`)
  }

  return (
    <div class="editor">
      <div class="editor-header">
        <h2 class="editor-title">{isNew() ? `New ${displayName()}` : `Edit ${displayName()}`}</h2>
      </div>

      <Show when={isNew() ? props.itemId : itemData()} keyed>
        {data => (
          <SchemaForm
            schema={props.schema}
            initialData={isNew() ? undefined : (data as ContentItem).data}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            submitLabel={isNew() ? 'Create' : 'Save'}
            pending={submission.pending}
            error={submission.error ? String(submission.error) : undefined}
          />
        )}
      </Show>
    </div>
  )
}
