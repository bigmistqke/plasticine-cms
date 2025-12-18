// Core
export { defineConfig, schema, getSchemaEntries, getSchemaMetadata } from "./schema";
export type { VersionedConfig, PlasticineConfig, VersionedSchema } from "./schema";

// Fields
export {
  text,
  textarea,
  markdown,
  number,
  boolean,
  date,
  datetime,
  slug,
  image,
  file,
  select,
  reference,
  optional,
} from "./fields";
export type { FieldMetadata, FieldUIType } from "./fields";

// GitHub
export {
  GitHubClient,
  startDeviceFlow,
  pollForToken,
  tokenStorage,
} from "./github";
export type { GitHubConfig, GitHubFile, GitHubContent } from "./github";

// Store
export {
  createCMSStore,
  CMSProvider,
  useCMS,
} from "./store";
export type {
  CMSProps,
  CMSState,
  CMSActions,
  CMSStore,
  ContentItem,
} from "./store";

// Components
export { CMS } from "./components/CMS";
export { Auth } from "./components/Auth";
export { CollectionList } from "./components/CollectionList";
export { ItemList } from "./components/ItemList";
export { Editor } from "./components/Editor";
export { SchemaForm } from "./components/SchemaForm";
export { DynamicField } from "./components/DynamicField";
