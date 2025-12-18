import { createForm, Form } from "@formisch/solid";
import { For, Show, createSignal } from "solid-js";
import type * as v from "valibot";
import { getSchemaEntries } from "../schema";
import { DynamicField } from "./DynamicField";

interface SchemaFormProps {
  schema: v.GenericSchema;
  initialData?: Record<string, unknown>;
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

/**
 * Auto-generated form from a Valibot schema
 */
export function SchemaForm(props: SchemaFormProps) {
  const [submitting, setSubmitting] = createSignal(false);
  const [submitError, setSubmitError] = createSignal<string | null>(null);

  const form = createForm({
    schema: props.schema,
    values: props.initialData,
  } as any);

  const entries = () => getSchemaEntries(props.schema);

  const handleSubmit = async (data: unknown) => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      await props.onSubmit(data as Record<string, unknown>);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form of={form} onSubmit={handleSubmit} class="schema-form">
      <div class="form-fields">
        <For each={Object.entries(entries() || {})}>
          {([key, fieldSchema]) => (
            <DynamicField
              form={form}
              path={[key]}
              schema={fieldSchema as v.GenericSchema}
            />
          )}
        </For>
      </div>

      <Show when={submitError()}>
        <div class="form-error">{submitError()}</div>
      </Show>

      <div class="form-actions">
        <Show when={props.onCancel}>
          <button
            type="button"
            class="btn btn-secondary"
            onClick={props.onCancel}
            disabled={submitting()}
          >
            Cancel
          </button>
        </Show>
        <button
          type="submit"
          class="btn btn-primary"
          disabled={submitting()}
        >
          {submitting() ? "Saving..." : props.submitLabel || "Save"}
        </button>
      </div>
    </Form>
  );
}
