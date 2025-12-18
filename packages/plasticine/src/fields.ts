import * as v from 'valibot'

export type FieldUIType =
  | 'text'
  | 'textarea'
  | 'markdown'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'image'
  | 'file'
  | 'slug'
  | 'select'
  | 'reference'

export interface FieldMetadata {
  ui: FieldUIType
  label?: string
  placeholder?: string
  description?: string
  [key: string]: unknown
}

// Helper to create metadata
function meta<T extends FieldMetadata>(meta: T) {
  return { '~plasticine': meta }
}

/**
 * Text field (single line)
 */
export function text(options?: {
  label?: string
  placeholder?: string
  minLength?: number
  maxLength?: number
}) {
  const schema = v.pipe(
    v.string(),
    v.metadata(
      meta({
        ui: 'text' as const,
        label: options?.label,
        placeholder: options?.placeholder,
      }),
    ),
  )

  // Add length constraints if specified
  if (options?.minLength !== undefined && options?.maxLength !== undefined) {
    return v.pipe(
      v.string(),
      v.minLength(options.minLength),
      v.maxLength(options.maxLength),
      v.metadata(
        meta({
          ui: 'text' as const,
          label: options?.label,
          placeholder: options?.placeholder,
        }),
      ),
    )
  }
  if (options?.minLength !== undefined) {
    return v.pipe(
      v.string(),
      v.minLength(options.minLength),
      v.metadata(
        meta({
          ui: 'text' as const,
          label: options?.label,
          placeholder: options?.placeholder,
        }),
      ),
    )
  }
  if (options?.maxLength !== undefined) {
    return v.pipe(
      v.string(),
      v.maxLength(options.maxLength),
      v.metadata(
        meta({
          ui: 'text' as const,
          label: options?.label,
          placeholder: options?.placeholder,
        }),
      ),
    )
  }

  return schema
}

/**
 * Textarea field (multi-line)
 */
export function textarea(options?: { label?: string; placeholder?: string }) {
  return v.pipe(
    v.string(),
    v.metadata(
      meta({
        ui: 'textarea' as const,
        label: options?.label,
        placeholder: options?.placeholder,
      }),
    ),
  )
}

/**
 * Markdown editor field
 */
export function markdown(options?: { label?: string; placeholder?: string }) {
  return v.pipe(
    v.string(),
    v.metadata(
      meta({
        ui: 'markdown' as const,
        label: options?.label,
        placeholder: options?.placeholder,
      }),
    ),
  )
}

/**
 * Number field
 */
export function number(options?: { label?: string; min?: number; max?: number; step?: number }) {
  return v.pipe(
    v.number(),
    v.metadata(
      meta({
        ui: 'number' as const,
        label: options?.label,
        min: options?.min,
        max: options?.max,
        step: options?.step,
      }),
    ),
  )
}

/**
 * Boolean toggle field
 */
export function boolean(options?: { label?: string; description?: string }) {
  return v.pipe(
    v.boolean(),
    v.metadata(
      meta({
        ui: 'boolean' as const,
        label: options?.label,
        description: options?.description,
      }),
    ),
  )
}

/**
 * Date field (date only, no time)
 */
export function date(options?: { label?: string }) {
  return v.pipe(
    v.string(),
    v.isoDate(),
    v.metadata(
      meta({
        ui: 'date' as const,
        label: options?.label,
      }),
    ),
  )
}

/**
 * DateTime field
 */
export function datetime(options?: { label?: string }) {
  return v.pipe(
    v.string(),
    v.isoTimestamp(),
    v.metadata(
      meta({
        ui: 'datetime' as const,
        label: options?.label,
      }),
    ),
  )
}

/**
 * Slug field with validation
 */
export function slug(options?: { label?: string; placeholder?: string }) {
  return v.pipe(
    v.string(),
    v.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be a valid slug (lowercase, hyphens only)'),
    v.metadata(
      meta({
        ui: 'slug' as const,
        label: options?.label,
        placeholder: options?.placeholder || 'my-slug',
      }),
    ),
  )
}

/**
 * Image field (stores URL/path)
 */
export function image(options?: {
  label?: string
  accept?: string
  path?: string // Upload path relative to media.path
}) {
  return v.pipe(
    v.string(),
    v.metadata(
      meta({
        ui: 'image' as const,
        label: options?.label,
        accept: options?.accept || 'image/*',
        path: options?.path,
      }),
    ),
  )
}

/**
 * File field (stores URL/path)
 */
export function file(options?: {
  label?: string
  accept?: string
  path?: string // Upload path relative to media.path
}) {
  return v.pipe(
    v.string(),
    v.metadata(
      meta({
        ui: 'file' as const,
        label: options?.label,
        accept: options?.accept,
        path: options?.path,
      }),
    ),
  )
}

/**
 * Select field with predefined options
 */
export function select<T extends string>(
  selectOptions: readonly T[],
  config?: {
    label?: string
  },
) {
  return v.pipe(
    v.picklist(selectOptions),
    v.metadata(
      meta({
        ui: 'select' as const,
        label: config?.label,
        options: selectOptions,
      }),
    ),
  )
}

/**
 * Reference to another collection
 */
export function reference<T extends string>(
  collection: T,
  options?: {
    label?: string
  },
) {
  return v.pipe(
    v.string(),
    v.metadata(
      meta({
        ui: 'reference' as const,
        label: options?.label,
        collection,
      }),
    ),
  )
}
