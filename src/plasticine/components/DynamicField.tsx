import { Field } from "@formisch/solid";
import { Match, Switch, For, Show, createSignal } from "solid-js";
import type * as v from "valibot";
import { getSchemaMetadata } from "../schema";
import type { FieldMetadata, FieldUIType } from "../fields";
import { useCMS } from "../store";

interface DynamicFieldProps {
  form: any;
  path: any;
  schema: v.GenericSchema;
  label?: string;
}

/**
 * Extract field UI type from schema metadata
 */
function getFieldUIType(schema: v.GenericSchema): FieldUIType {
  const metadata = getSchemaMetadata(schema) as Partial<FieldMetadata>;
  if (metadata.ui) return metadata.ui;

  // Infer from schema type
  if ("type" in schema) {
    switch (schema.type) {
      case "string":
        return "text";
      case "number":
        return "number";
      case "boolean":
        return "boolean";
      default:
        return "text";
    }
  }
  return "text";
}

/**
 * Get label from schema metadata or path
 */
function getFieldLabel(schema: v.GenericSchema, path: readonly [string, ...(string | number)[]]): string {
  const metadata = getSchemaMetadata(schema) as Partial<FieldMetadata>;
  if (metadata.label) return metadata.label;

  // Convert path to human-readable label
  const lastPart = path[path.length - 1];
  return String(lastPart)
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/**
 * Dynamic field component that renders the appropriate input based on schema
 */
export function DynamicField(props: DynamicFieldProps) {
  const uiType = () => getFieldUIType(props.schema);
  const label = () => props.label || getFieldLabel(props.schema, props.path);
  const metadata = () => getSchemaMetadata(props.schema) as Partial<FieldMetadata>;

  return (
    <Field of={props.form} path={props.path}>
      {(field) => (
        <div class="field">
          <label class="field-label">{label()}</label>

          <Switch fallback={<TextInput field={field} metadata={metadata()} />}>
            <Match when={uiType() === "text"}>
              <TextInput field={field} metadata={metadata()} />
            </Match>

            <Match when={uiType() === "textarea"}>
              <TextareaInput field={field} metadata={metadata()} />
            </Match>

            <Match when={uiType() === "markdown"}>
              <MarkdownInput field={field} metadata={metadata()} />
            </Match>

            <Match when={uiType() === "number"}>
              <NumberInput field={field} metadata={metadata()} />
            </Match>

            <Match when={uiType() === "boolean"}>
              <BooleanInput field={field} metadata={metadata()} />
            </Match>

            <Match when={uiType() === "date"}>
              <DateInput field={field} metadata={metadata()} />
            </Match>

            <Match when={uiType() === "datetime"}>
              <DateTimeInput field={field} metadata={metadata()} />
            </Match>

            <Match when={uiType() === "slug"}>
              <SlugInput field={field} metadata={metadata()} />
            </Match>

            <Match when={uiType() === "image"}>
              <ImageInput field={field} metadata={metadata()} />
            </Match>

            <Match when={uiType() === "select"}>
              <SelectInput field={field} metadata={metadata()} />
            </Match>

            <Match when={uiType() === "reference"}>
              <ReferenceInput field={field} metadata={metadata()} />
            </Match>
          </Switch>

          <Show when={field.errors?.[0]}>
            <span class="field-error">{field.errors![0]}</span>
          </Show>
        </div>
      )}
    </Field>
  );
}

// Input Components
interface FieldState {
  input: unknown;
  props: Record<string, unknown>;
  errors: readonly string[] | null;
}

interface InputProps {
  field: FieldState;
  metadata: Partial<FieldMetadata>;
}

function TextInput(props: InputProps) {
  return (
    <input
      type="text"
      class="input"
      {...(props.field.props as Record<string, string>)}
      value={(props.field.input as string) ?? ""}
      placeholder={props.metadata.placeholder}
    />
  );
}

function TextareaInput(props: InputProps) {
  return (
    <textarea
      class="input textarea"
      {...(props.field.props as Record<string, string>)}
      value={(props.field.input as string) ?? ""}
      placeholder={props.metadata.placeholder}
      rows={5}
    />
  );
}

function MarkdownInput(props: InputProps) {
  return (
    <textarea
      class="input textarea markdown-editor"
      {...(props.field.props as Record<string, string>)}
      value={(props.field.input as string) ?? ""}
      placeholder={props.metadata.placeholder || "Write markdown..."}
      rows={10}
    />
  );
}

function NumberInput(props: InputProps) {
  return (
    <input
      type="number"
      class="input"
      {...(props.field.props as Record<string, string>)}
      value={(props.field.input as number) ?? ""}
      min={props.metadata.min as number}
      max={props.metadata.max as number}
      step={props.metadata.step as number}
    />
  );
}

function BooleanInput(props: InputProps) {
  return (
    <label class="checkbox-label">
      <input
        type="checkbox"
        class="checkbox"
        {...(props.field.props as Record<string, string>)}
        checked={(props.field.input as boolean) ?? false}
      />
      <Show when={props.metadata.description}>
        <span class="checkbox-description">{props.metadata.description}</span>
      </Show>
    </label>
  );
}

function DateInput(props: InputProps) {
  return (
    <input
      type="date"
      class="input"
      {...(props.field.props as Record<string, string>)}
      value={(props.field.input as string) ?? ""}
    />
  );
}

function DateTimeInput(props: InputProps) {
  return (
    <input
      type="datetime-local"
      class="input"
      {...(props.field.props as Record<string, string>)}
      value={(props.field.input as string) ?? ""}
    />
  );
}

function SlugInput(props: InputProps) {
  return (
    <input
      type="text"
      class="input slug-input"
      {...(props.field.props as Record<string, string>)}
      value={(props.field.input as string) ?? ""}
      placeholder={props.metadata.placeholder || "my-slug"}
      pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
    />
  );
}

function ImageInput(props: InputProps) {
  const [, actions] = useCMS();
  const [uploading, setUploading] = createSignal(false);
  let urlInputRef: HTMLInputElement | undefined;

  const value = () => props.field.input as string;
  const accept = () => (props.metadata.accept as string) || "image/*";

  const handleFileSelect = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await actions.uploadFile(file);
      // Update the field value by setting the input and triggering change
      if (urlInputRef) {
        urlInputRef.value = url;
        urlInputRef.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Upload failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div class="image-input">
      <div class="image-input-row">
        <input
          ref={urlInputRef}
          type="url"
          class="input"
          {...(props.field.props as Record<string, string>)}
          value={value() ?? ""}
          placeholder="https://example.com/image.jpg"
        />
        <label class="btn btn-secondary upload-btn">
          {uploading() ? "..." : "Upload"}
          <input
            type="file"
            accept={accept()}
            onChange={handleFileSelect}
            style={{ display: "none" }}
            disabled={uploading()}
          />
        </label>
      </div>
      <Show when={value()}>
        <img
          src={value()}
          alt="Preview"
          class="image-preview"
        />
      </Show>
    </div>
  );
}

function SelectInput(props: InputProps) {
  const options = () => (props.metadata.options as string[]) || [];

  return (
    <select
      class="input select"
      {...(props.field.props as Record<string, string>)}
      value={(props.field.input as string) ?? ""}
    >
      <option value="">Select...</option>
      <For each={options()}>
        {(option) => <option value={option}>{option}</option>}
      </For>
    </select>
  );
}

function ReferenceInput(props: InputProps) {
  const [state] = useCMS();
  const collectionName = () => props.metadata.collection as string;
  const items = () => state.collections[collectionName()]?.items || [];

  return (
    <select
      class="input select"
      {...(props.field.props as Record<string, string>)}
      value={(props.field.input as string) ?? ""}
    >
      <option value="">Select {collectionName()}...</option>
      <For each={items()}>
        {(item) => (
          <option value={item.id}>
            {(item.data.name as string) ||
              (item.data.title as string) ||
              item.id}
          </option>
        )}
      </For>
    </select>
  );
}
