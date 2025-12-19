import { Field, FieldArray, insert, remove } from '@formisch/solid'
import { createSignal, For, Show, type Component } from 'solid-js'
import { Dynamic, Index } from 'solid-js/web'
import type * as v from 'valibot'
import type { FieldMetadata, FieldUIType } from '../config/fields'
import { getSchemaMetadata } from '../config/schema'
import { useCMS } from '../context'

export interface FieldState {
  input: unknown
  props: Record<string, unknown>
  errors: readonly string[] | null
}

export interface FieldComponentProps {
  field: FieldState
  metadata: Partial<FieldMetadata>
}

export interface DynamicFieldProps {
  form: any
  path: any
  schema: v.GenericSchema
  label?: string
}

/**********************************************************************************/
/*                                                                                */
/*                                     Utils                                      */
/*                                                                                */
/**********************************************************************************/

/**
 * Check if a schema is an array type
 */
function isArraySchema(schema: v.GenericSchema): boolean {
  return 'type' in schema && schema.type === 'array' && 'item' in schema
}

/**
 * Check if a schema is a nested object (not a scalar field type)
 */
function isObjectSchema(schema: v.GenericSchema): boolean {
  // If it has ui metadata, it's a field type (text, image, etc.), not a nested object
  const metadata = getSchemaMetadata(schema)
  if (metadata.ui) return false

  return 'type' in schema && schema.type === 'object' && 'entries' in schema
}

/**
 * Extract field UI type from schema metadata
 */
function getFieldUIType(schema: v.GenericSchema): FieldUIType {
  const metadata = getSchemaMetadata(schema) as Partial<FieldMetadata>
  if (metadata.ui) return metadata.ui

  // Infer from schema type
  if ('type' in schema) {
    switch (schema.type) {
      case 'string':
        return 'text'
      case 'number':
        return 'number'
      case 'boolean':
        return 'boolean'
      default:
        return 'text'
    }
  }
  return 'text'
}

/**
 * Get label from schema metadata or path
 */
function getFieldLabel(
  schema: v.GenericSchema,
  path: readonly [string, ...(string | number)[]],
): string {
  const metadata = getSchemaMetadata(schema) as Partial<FieldMetadata>
  if (metadata.label) return metadata.label

  // Convert path to human-readable label
  const lastPart = path[path.length - 1]
  return String(lastPart)
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim()
}

/**********************************************************************************/
/*                                                                                */
/*                                 Field Components                               */
/*                                                                                */
/**********************************************************************************/

export const TextField: Component<FieldComponentProps> = props => {
  return (
    <input
      type="text"
      class="input"
      {...props.field.props}
      value={(props.field.input as string) ?? ''}
      placeholder={props.metadata.placeholder}
    />
  )
}

export const TextareaField: Component<FieldComponentProps> = props => {
  return (
    <textarea
      class="input textarea"
      {...props.field.props}
      value={(props.field.input as string) ?? ''}
      placeholder={props.metadata.placeholder}
      rows={5}
    />
  )
}

export const MarkdownField: Component<FieldComponentProps> = props => {
  return (
    <textarea
      class="input textarea markdown-editor"
      {...props.field.props}
      value={(props.field.input as string) ?? ''}
      placeholder={props.metadata.placeholder || 'Write markdown...'}
      rows={10}
    />
  )
}

export const NumberField: Component<FieldComponentProps> = props => {
  return (
    <input
      type="number"
      class="input"
      {...props.field.props}
      value={(props.field.input as number) ?? ''}
      min={props.metadata.min as number}
      max={props.metadata.max as number}
      step={props.metadata.step as number}
    />
  )
}

export const BooleanField: Component<FieldComponentProps> = props => {
  return (
    <label class="checkbox-label">
      <input
        type="checkbox"
        class="checkbox"
        {...props.field.props}
        checked={(props.field.input as boolean) ?? false}
      />
      <Show when={props.metadata.description}>
        <span class="checkbox-description">{props.metadata.description}</span>
      </Show>
    </label>
  )
}

export const DateField: Component<FieldComponentProps> = props => {
  return (
    <input
      type="date"
      class="input"
      {...props.field.props}
      value={(props.field.input as string) ?? ''}
    />
  )
}

export const DateTimeField: Component<FieldComponentProps> = props => {
  return (
    <input
      type="datetime-local"
      class="input"
      {...props.field.props}
      value={(props.field.input as string) ?? ''}
    />
  )
}

export const SlugField: Component<FieldComponentProps> = props => {
  return (
    <input
      type="text"
      class="input slug-input"
      {...props.field.props}
      value={(props.field.input as string) ?? ''}
      placeholder={props.metadata.placeholder || 'my-slug'}
      pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
    />
  )
}

export const ImageField: Component<FieldComponentProps> = props => {
  const [, actions] = useCMS()
  const [uploading, setUploading] = createSignal(false)
  let urlInputRef: HTMLInputElement | undefined

  const value = () => props.field.input as string
  const accept = () => (props.metadata.accept as string) || 'image/*'
  const fieldPath = () => props.metadata.path as string | undefined

  const handleFileSelect = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const url = await actions.uploadFile(file, fieldPath())
      if (urlInputRef) {
        urlInputRef.value = url
        urlInputRef.dispatchEvent(new Event('input', { bubbles: true }))
      }
    } catch (err) {
      console.error('Upload failed:', err)
      alert('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div class="image-input">
      <div class="image-input-row">
        <input
          ref={urlInputRef}
          type="url"
          class="input"
          {...props.field.props}
          value={value() ?? ''}
          placeholder="https://example.com/image.jpg"
        />
        <label class="btn btn-secondary upload-btn">
          {uploading() ? '...' : 'Upload'}
          <input
            type="file"
            accept={accept()}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            disabled={uploading()}
          />
        </label>
      </div>
      <Show when={value()}>
        <img src={value()} alt="Preview" class="image-preview" />
      </Show>
    </div>
  )
}

export const SelectField: Component<FieldComponentProps> = props => {
  const options = () => (props.metadata.options as string[]) || []

  return (
    <select class="input select" {...props.field.props} value={(props.field.input as string) ?? ''}>
      <option value="">Select...</option>
      <For each={options()}>{option => <option value={option}>{option}</option>}</For>
    </select>
  )
}

export const ReferenceField: Component<FieldComponentProps> = props => {
  const [state] = useCMS()
  const collectionName = () => props.metadata.collection as string
  const items = () => state.collections[collectionName()]?.items || []

  return (
    <select class="input select" {...props.field.props} value={(props.field.input as string) ?? ''}>
      <option value="">Select {collectionName()}...</option>
      <For each={items()}>
        {item => (
          <option value={item.id}>
            {(item.data.name as string) || (item.data.title as string) || item.id}
          </option>
        )}
      </For>
    </select>
  )
}

export const fieldComponents: Record<FieldUIType, Component<FieldComponentProps>> = {
  text: TextField,
  textarea: TextareaField,
  markdown: MarkdownField,
  number: NumberField,
  boolean: BooleanField,
  date: DateField,
  datetime: DateTimeField,
  slug: SlugField,
  image: ImageField,
  file: ImageField,
  select: SelectField,
  reference: ReferenceField,
}

/**
 * Dynamic field component that renders the appropriate input based on schema
 */
export function DynamicField(props: DynamicFieldProps) {
  const uiType = () => getFieldUIType(props.schema)
  const label = () => props.label || getFieldLabel(props.schema, props.path)
  const metadata = () => getSchemaMetadata(props.schema) as Partial<FieldMetadata>

  // Handle array schemas
  if (isArraySchema(props.schema)) {
    return (
      <ArrayField
        form={props.form}
        path={props.path}
        itemSchema={(props.schema as { item: v.GenericSchema }).item}
        label={label()}
        metadata={metadata()}
      />
    )
  }

  // Handle nested object schemas
  if (isObjectSchema(props.schema)) {
    return (
      <ObjectField
        form={props.form}
        path={props.path}
        entries={(props.schema as { entries: Record<string, v.GenericSchema> }).entries}
        label={label()}
      />
    )
  }

  return (
    <Field of={props.form} path={props.path}>
      {field => (
        <div class="field">
          <label class="field-label">{label()}</label>
          <Dynamic
            component={fieldComponents[uiType()]}
            field={field as FieldState}
            metadata={metadata()}
          />
          <Show when={field.errors?.[0]}>
            <span class="field-error">{field.errors![0]}</span>
          </Show>
        </div>
      )}
    </Field>
  )
}

// Object Field Component (for nested objects)
interface ObjectFieldProps {
  form: any
  path: readonly [string, ...(string | number)[]]
  entries: Record<string, v.GenericSchema>
  label: string
}

function ObjectField(props: ObjectFieldProps) {
  return (
    <div class="field object-field">
      <label class="field-label">{props.label}</label>
      <div class="object-field-entries">
        <For each={Object.entries(props.entries)}>
          {([key, fieldSchema]) => (
            <DynamicField form={props.form} path={[...props.path, key]} schema={fieldSchema} />
          )}
        </For>
      </div>
    </div>
  )
}

// Array Field Component
export interface ArrayFieldProps {
  form: any
  path: readonly [string, ...(string | number)[]]
  itemSchema: v.GenericSchema
  label: string
  metadata: Partial<FieldMetadata>
}

export function ArrayField(props: ArrayFieldProps) {
  const handleAdd = () => {
    insert(props.form, {
      path: props.path,
      initialInput: getDefaultValue(props.itemSchema) as any,
    })
  }

  const handleRemove = (index: number) => {
    remove(props.form, {
      path: props.path,
      at: index,
    })
  }

  return (
    <FieldArray of={props.form} path={props.path}>
      {fieldArray => (
        <div class="field array-field">
          <div class="array-field-header">
            <label class="field-label">{props.label}</label>
            <button type="button" class="btn btn-small btn-secondary" onClick={handleAdd}>
              + Add
            </button>
          </div>

          <div class="array-field-items">
            <Index each={fieldArray.items}>
              {(_, index) => (
                <div class="array-field-item">
                  <div class="array-field-item-content">
                    <DynamicField
                      form={props.form}
                      path={[...props.path, index]}
                      schema={props.itemSchema}
                      label={`${props.label} ${index + 1}`}
                    />
                  </div>
                  <button
                    type="button"
                    class="btn btn-small btn-danger array-field-remove"
                    onClick={() => handleRemove(index)}
                  >
                    ×
                  </button>
                </div>
              )}
            </Index>
          </div>

          <Show when={fieldArray.items.length === 0}>
            <div class="array-field-empty">No items yet. Click "Add" to create one.</div>
          </Show>
        </div>
      )}
    </FieldArray>
  )
}

/**
 * Get default value for a schema type
 */
function getDefaultValue(schema: v.GenericSchema): unknown {
  if (!('type' in schema)) return undefined

  switch (schema.type) {
    case 'string':
      return ''
    case 'number':
      return 0
    case 'boolean':
      return false
    case 'array':
      return []
    case 'object':
      // For objects, create default values for each entry
      if ('entries' in schema && typeof schema.entries === 'object') {
        const entries = schema.entries as Record<string, v.GenericSchema>
        return Object.fromEntries(
          Object.entries(entries).map(([key, fieldSchema]) => [key, getDefaultValue(fieldSchema)]),
        )
      }
      return {}
    default:
      return undefined
  }
}
