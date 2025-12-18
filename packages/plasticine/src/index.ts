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

// Backend
export type { Backend, ContentBackend, MediaBackend, ContentItem, MediaFile } from "./backend";

// GitHub backend
export {
  GitHubClient,
  github,
  createGitHubBackend,
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
  BackendFactory,
  CMSProps,
  CMSState,
  CMSActions,
  CMSStore,
  MediaState,
} from "./store";

// Components
export { CMS } from "./components/CMS";
export { Auth } from "./components/Auth";
export { CollectionList } from "./components/CollectionList";
export { ItemList } from "./components/ItemList";
export { Editor } from "./components/Editor";
export { SchemaForm } from "./components/SchemaForm";
export { DynamicField } from "./components/DynamicField";
export { MediaLibrary } from "./components/MediaLibrary";
