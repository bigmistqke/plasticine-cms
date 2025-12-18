import * as v from "valibot";
import { Prettify } from "../types";

class SchemaError<
  TSchema extends
  | v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>
  | v.BaseSchemaAsync<unknown, unknown, v.BaseIssue<unknown>>
> extends Error {
  readonly issues: Array<[v.InferIssue<TSchema>, ...v.InferIssue<TSchema>[]]>;

  constructor(
    issues: Array<[v.InferIssue<TSchema>, ...v.InferIssue<TSchema>[]]>
  ) {
    super("Schema validation failed across all versions");
    this.issues = issues;
  }
}

interface Version<
  T1 extends v.GenericSchema = v.GenericSchema,
  T2 extends v.GenericSchema = v.GenericSchema
> {
  schema: T2;
  transform(value: v.InferInput<T1>): v.InferInput<T2>;
}

export interface VersionedSchema<
  TVersions extends Array<Version>,
  TSchema extends v.GenericSchema
> {
  /** The current (latest) schema */
  schema: TSchema;

  /** Parse value, migrating from older versions if needed */
  parse(
    value: v.InferInput<TVersions[number]["schema"] | TSchema>
  ): v.InferOutput<TSchema>;

  /** Add a new version with migration transform */
  version<
    TNewSchema extends v.GenericSchema,
    TTransform extends (value: v.InferOutput<TSchema>) => v.InferInput<TNewSchema>
  >(
    schema: TNewSchema,
    transform: TTransform
  ): Prettify<
    VersionedSchema<
      [...TVersions, { schema: TSchema; transform: TTransform }],
      TNewSchema
    >
  >;
}

/**
 * Create a versioned schema with migration support
 */
export function schema<TSchema extends v.GenericSchema>(
  initialSchema: TSchema
): VersionedSchema<[], TSchema> {
  return {
    schema: initialSchema,
    parse(value) {
      const result = v.safeParse(initialSchema, value);
      if (result.success) {
        return result.output;
      }
      throw new SchemaError([[result.issues[0], ...result.issues.slice(1)]]);
    },
    version(newSchema, transform) {
      return createVersioned(
        [{ schema: initialSchema, transform }],
        newSchema
      );
    },
  };
}

function createVersioned<
  TVersions extends Array<Version>,
  TSchema extends v.GenericSchema
>(
  versions: TVersions,
  currentSchema: TSchema
): Prettify<VersionedSchema<TVersions, TSchema>> {
  return {
    schema: currentSchema,
    parse(value) {
      // Try current schema first
      const result = v.safeParse(currentSchema, value);
      if (result.success) {
        return result.output;
      }

      // Try older versions
      const versionResults: Array<Version & v.SafeParseResult<TSchema>> = [];
      let foundValidVersion = false;

      for (const version of versions) {
        const versionResult = v.safeParse(version.schema, value);
        versionResults.push({ ...version, ...versionResult });

        if (versionResult.success) {
          foundValidVersion = true;
          break;
        }
      }

      if (foundValidVersion) {
        // Apply transforms in reverse order to migrate to current
        return versionResults
          .toReversed()
          .reduce((val, { transform }) => transform(val), value);
      }

      throw new SchemaError(
        versionResults
          .map(({ issues }) => issues)
          .filter((v): v is NonNullable<typeof v> => v !== undefined)
      );
    },
    version(newSchema, transform) {
      return createVersioned(
        [{ schema: currentSchema, transform }, ...versions],
        newSchema
      );
    },
  } as Prettify<VersionedSchema<TVersions, TSchema>>;
}

/**
 * Get the entries of an object schema (for form generation)
 */
export function getSchemaEntries(
  schema: v.GenericSchema
): Record<string, v.GenericSchema> | null {
  if ("entries" in schema && typeof schema.entries === "object") {
    return schema.entries as Record<string, v.GenericSchema>;
  }
  // Handle wrapped schemas (pipe, optional, etc.)
  if ("wrapped" in schema && schema.wrapped) {
    return getSchemaEntries(schema.wrapped as v.GenericSchema);
  }
  return null;
}

/**
 * Extract metadata from a schema (for UI hints)
 */
export function getSchemaMetadata(schema: v.GenericSchema): Record<string, unknown> {
  // Check for metadata in pipe
  if ("pipe" in schema && Array.isArray(schema.pipe)) {
    for (const item of schema.pipe) {
      if (item && typeof item === "object" && "type" in item && item.type === "metadata") {
        const metadata = (item as { metadata: Record<string, unknown> }).metadata;
        // Check for our ~plasticine wrapper
        if (metadata && typeof metadata === "object" && "~plasticine" in metadata) {
          return metadata["~plasticine"] as Record<string, unknown>;
        }
        return metadata || {};
      }
    }
  }
  // Handle wrapped schemas (optional, nullable, etc.)
  if ("wrapped" in schema && schema.wrapped) {
    return getSchemaMetadata(schema.wrapped as v.GenericSchema);
  }
  return {};
}
