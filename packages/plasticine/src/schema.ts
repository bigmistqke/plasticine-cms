import * as v from "valibot";

/**
 * Schema versioning system with automatic migrations
 */

// =============================================================================
// Config Types
// =============================================================================

export interface PlasticineConfig {
  schemas: Record<string, v.GenericSchema>;
}

export interface VersionedConfig {
  /** Current config */
  config: PlasticineConfig;
  /** All versions (oldest first) */
  versions: PlasticineConfig[];
  /** Migration functions (oldest first) */
  migrations: Array<(old: any) => any>;

  /** Add a new version with migration */
  version(
    newConfig: PlasticineConfig,
    migrate: (old: any) => any
  ): VersionedConfig;

  /** Parse content data for a collection, migrating if needed */
  parseCollection(collection: string, data: unknown): unknown;

  /** Get current schema for a collection */
  getSchema(collection: string): v.GenericSchema | undefined;

  /** Get all collection names */
  getCollections(): string[];
}

/**
 * Define a versioned CMS config
 * Accepts an object where keys are collection names and values are VersionedSchema objects
 */
export function defineConfig(
  collections: Record<string, VersionedSchema<any[], v.GenericSchema>>
): VersionedConfig {
  // Extract the current schema from each VersionedSchema
  const schemas: Record<string, v.GenericSchema> = {};
  for (const [name, versionedSchema] of Object.entries(collections)) {
    schemas[name] = versionedSchema.schema;
  }
  const config: PlasticineConfig = { schemas };
  return createVersionedConfig([config], [], collections);
}

function createVersionedConfig(
  versions: PlasticineConfig[],
  migrations: Array<(old: any) => any>,
  collections: Record<string, VersionedSchema<any[], v.GenericSchema>>
): VersionedConfig {
  const current = versions[versions.length - 1];

  return {
    config: current,
    versions,
    migrations,

    version(newConfig, migrate) {
      return createVersionedConfig(
        [...versions, newConfig],
        [...migrations, migrate],
        collections
      );
    },

    parseCollection(collection, data) {
      const versionedSchema = collections[collection];
      if (!versionedSchema) {
        throw new Error(`Unknown collection: ${collection}`);
      }

      // Use the VersionedSchema's parse method which handles migrations internally
      return versionedSchema.parse(data);
    },

    getSchema(collection) {
      return current.schemas[collection];
    },

    getCollections() {
      return Object.keys(current.schemas);
    },
  };
}

// =============================================================================
// Legacy Schema API (for individual collection schemas)
// =============================================================================

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

type Prettify<T> = { [K in keyof T]: T[K] } & {};

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
