import { createForm, Form } from '@formisch/solid'
import { For, Show } from 'solid-js'
import type * as v from 'valibot'
import { getSchemaEntries } from '../config/schema'
import { DynamicField } from './FieldComponents'

interface SchemaFormProps {
  schema: v.GenericSchema
  initialData?: Record<string, unknown>
  onSubmit: (data: Record<string, unknown>) => Promise<void>
  onCancel?: () => void
  submitLabel?: string
  pending?: boolean
  error?: string
}

/**
 * Auto-generated form from a Valibot schema
 */
export function SchemaForm(props: SchemaFormProps) {
  const form = createForm({
    schema: props.schema,
    values: props.initialData,
  } as any)

  const entries = () => getSchemaEntries(props.schema)

  const handleSubmit = async (data: unknown) => {
    await props.onSubmit(data as Record<string, unknown>)
  }

  return (
    <Form of={form} onSubmit={handleSubmit} class="schema-form">
      <div class="form-fields">
        <For each={Object.entries(entries() || {})}>
          {([key, fieldSchema]) => (
            <DynamicField form={form} path={[key]} schema={fieldSchema as v.GenericSchema} />
          )}
        </For>
      </div>

      <Show when={props.error}>
        <div class="form-error">{props.error}</div>
      </Show>

      <div class="form-actions">
        <Show when={props.onCancel}>
          <button
            type="button"
            class="btn btn-secondary"
            onClick={props.onCancel}
            disabled={props.pending}
          >
            Cancel
          </button>
        </Show>
        <button type="submit" class="btn btn-primary" disabled={props.pending}>
          {props.pending ? 'Saving...' : props.submitLabel || 'Save'}
        </button>
      </div>
    </Form>
  )
}
