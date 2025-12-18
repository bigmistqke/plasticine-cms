import * as v from "valibot";
import { VersionedSchema } from "./schema";

export interface PlasticineConfig {
    /** Parse content data for a collection, migrating if needed */
    parseCollection(collection: string, data: unknown): unknown;

    /** Get current schema for a collection */
    getSchema(collection: string): v.GenericSchema | undefined;

    /** Get all collection names */
    getCollections(): string[];
}

/**
 * Define a CMS config
 * Accepts an object where keys are collection names and values are VersionedSchema objects
 */
export function defineConfig(
    collections: Record<string, VersionedSchema<any[], v.GenericSchema>>
): PlasticineConfig {
    const schemas: Record<string, v.GenericSchema> = {};
    for (const [name, versionedSchema] of Object.entries(collections)) {
        schemas[name] = versionedSchema.schema;
    }

    return {
        parseCollection(collection, data) {
            const versionedSchema = collections[collection];
            if (!versionedSchema) {
                throw new Error(`Unknown collection: ${collection}`);
            }
            return versionedSchema.parse(data);
        },

        getSchema(collection) {
            return schemas[collection];
        },

        getCollections() {
            return Object.keys(schemas);
        },
    };
}