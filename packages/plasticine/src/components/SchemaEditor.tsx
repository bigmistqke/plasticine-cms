import { useAction, useSubmission } from '@solidjs/router'
import { createEffect, createSignal, onMount, Show } from 'solid-js'
import { saveSchemaAction } from '../actions'
import { useCMS } from '../context'

export function SchemaEditor() {
  const [state, actions] = useCMS()
  const [localContent, setLocalContent] = createSignal('')
  const [isDirty, setIsDirty] = createSignal(false)

  const saveSchema = useAction(saveSchemaAction)
  const submission = useSubmission(saveSchemaAction)

  // Load schema on mount if not already loaded
  onMount(() => {
    if (!state.schema.content && !state.schema.loading) {
      actions.loadSchema()
    }
  })

  // Sync local content when schema loads
  createEffect(() => {
    if (state.schema.content && !isDirty()) {
      setLocalContent(state.schema.content)
    }
  })

  // Reset dirty state on successful save
  createEffect(() => {
    if (submission.result?.ok) {
      setIsDirty(false)
    }
  })

  const handleChange = (e: Event) => {
    const value = (e.target as HTMLTextAreaElement).value
    setLocalContent(value)
    setIsDirty(value !== state.schema.content)
  }

  const handleSave = () => {
    saveSchema(localContent(), actions)
  }

  const handleReset = () => {
    setLocalContent(state.schema.content)
    setIsDirty(false)
  }

  return (
    <div class="schema-editor">
      <div class="schema-editor-header">
        <h2>Schema Editor</h2>
        <div class="schema-editor-actions">
          <Show when={isDirty()}>
            <button class="btn btn-secondary" onClick={handleReset} disabled={submission.pending}>
              Reset
            </button>
          </Show>
          <button
            class="btn btn-primary"
            onClick={handleSave}
            disabled={!isDirty() || submission.pending}
          >
            {submission.pending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <Show when={submission.error}>
        <div class="schema-editor-error">{String(submission.error)}</div>
      </Show>

      <Show
        when={!state.schema.loading}
        fallback={<div class="schema-editor-loading">Loading schema...</div>}
      >
        <textarea
          class="schema-editor-textarea"
          value={localContent()}
          onInput={handleChange}
          spellcheck={false}
        />
      </Show>

      <div class="schema-editor-hint">
        Saving will commit changes and trigger migrations on all content.
      </div>
    </div>
  )
}
