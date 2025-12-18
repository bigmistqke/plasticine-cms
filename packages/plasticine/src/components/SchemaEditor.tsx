import { createEffect, createSignal, onMount, Show } from 'solid-js'
import { useCMS } from '../context'

export function SchemaEditor() {
  const [state, actions] = useCMS()
  const [localContent, setLocalContent] = createSignal('')
  const [isDirty, setIsDirty] = createSignal(false)

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

  const handleChange = (e: Event) => {
    const value = (e.target as HTMLTextAreaElement).value
    setLocalContent(value)
    setIsDirty(value !== state.schema.content)
  }

  const handleSave = async () => {
    try {
      await actions.saveSchema(localContent())
      setIsDirty(false)
    } catch (error) {
      console.error('Failed to save schema:', error)
    }
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
            <button class="btn btn-secondary" onClick={handleReset} disabled={state.schema.saving}>
              Reset
            </button>
          </Show>
          <button
            class="btn btn-primary"
            onClick={handleSave}
            disabled={!isDirty() || state.schema.saving}
          >
            {state.schema.saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      <Show when={state.schema.error}>
        <div class="schema-editor-error">{state.schema.error}</div>
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
