import { createSignal, createContext, useContext, type JSX } from "solid-js";
import { createStore, produce } from "solid-js/store";
import {
  GitHubClient,
  tokenStorage,
  type GitHubConfig,
  type GitHubFile,
  type DeviceCodeResponse,
} from "./github";
import type { VersionedConfig } from "./schema";
import { getSchemaEntries, getSchemaMetadata } from "./schema";

/**
 * CMS Store Types
 */

export interface CMSProps {
  config: VersionedConfig;
  github: GitHubConfig;
}

export interface ContentItem {
  id: string;
  filename: string;
  sha: string;
  data: Record<string, unknown>;
}

export interface CollectionState {
  items: ContentItem[];
  loading: boolean;
  error: string | null;
}

export interface MediaFile {
  name: string;
  path: string;
  sha: string;
  url: string;
  size: number;
}

export interface MediaState {
  files: MediaFile[];
  loading: boolean;
  error: string | null;
}

export interface CMSState {
  // Auth
  authenticated: boolean;
  user: { login: string; avatar_url: string; name: string } | null;
  authLoading: boolean;
  authError: string | null;
  deviceCode: DeviceCodeResponse | null;

  // Collections
  collections: Record<string, CollectionState>;

  // Media
  media: MediaState;

  // Navigation
  currentView: "collections" | "media";
  currentCollection: string | null;
  currentItem: string | null;
}

export interface CMSActions {
  // Auth
  loginWithToken(token: string): Promise<void>;
  startOAuth(): Promise<void>;
  logout(): void;

  // Collections
  loadCollection(name: string): Promise<void>;
  getItem(collection: string, id: string): Promise<ContentItem>;
  saveItem(collection: string, data: Record<string, unknown>, existingSha?: string): Promise<void>;
  deleteItem(collection: string, id: string, sha: string): Promise<void>;

  // Files
  uploadFile(file: File, fieldPath?: string): Promise<string>;

  // Media
  loadMedia(): Promise<void>;
  deleteMedia(url: string, path: string, sha: string): Promise<void>;
  getMediaReferences(url: string): Array<{ collection: string; id: string; field: string }>;

  // Navigation
  setCurrentView(view: "collections" | "media"): void;
  setCurrentCollection(name: string | null): void;
  setCurrentItem(id: string | null): void;
}

export type CMSStore = [CMSState, CMSActions];

/**
 * Create the CMS store
 */
export function createCMSStore(props: CMSProps): CMSStore {
  const { config, github } = props;
  let client: GitHubClient | null = null;

  const collections = config.getCollections();

  const [state, setState] = createStore<CMSState>({
    authenticated: false,
    user: null,
    authLoading: false,
    authError: null,
    deviceCode: null,
    collections: Object.fromEntries(
      collections.map((name) => [
        name,
        { items: [], loading: false, error: null },
      ])
    ),
    media: { files: [], loading: false, error: null },
    currentView: "collections",
    currentCollection: null,
    currentItem: null,
  });

  /**
   * Get media field names from a schema (fields with ui: "image" or "file")
   */
  const getMediaFields = (collectionName: string): string[] => {
    const schema = config.getSchema(collectionName);
    if (!schema) return [];

    const entries = getSchemaEntries(schema);
    if (!entries) return [];

    return Object.entries(entries)
      .filter(([_, fieldSchema]) => {
        const meta = getSchemaMetadata(fieldSchema);
        return meta.ui === "image" || meta.ui === "file";
      })
      .map(([key]) => key);
  };

  const getFilename = (collection: string, data: Record<string, unknown>): string => {
    // Use slug field if present, otherwise fallback to timestamp
    const value = data.slug ?? data.id;
    if (typeof value === "string" && value) {
      return `${value}.json`;
    }
    return `${Date.now()}.json`;
  };

  const actions: CMSActions = {
    async loginWithToken(token: string) {
      setState("authLoading", true);
      setState("authError", null);

      try {
        client = new GitHubClient(token, github);
        const user = await client.getUser();

        tokenStorage.set(token);
        setState(
          produce((s) => {
            s.authenticated = true;
            s.user = user;
            s.authLoading = false;
          })
        );
      } catch (error) {
        setState(
          produce((s) => {
            s.authLoading = false;
            s.authError = error instanceof Error ? error.message : "Authentication failed";
          })
        );
        throw error;
      }
    },

    async startOAuth() {
      // Device Flow requires a CORS proxy for browsers
      // For now, use PAT mode instead
      throw new Error("OAuth not available in browser. Please use a Personal Access Token.");
    },

    logout() {
      tokenStorage.remove();
      client = null;
      setState(
        produce((s) => {
          s.authenticated = false;
          s.user = null;
        })
      );
    },

    async loadCollection(name: string) {
      if (!client) throw new Error("Not authenticated");

      const schema = config.getSchema(name);
      if (!schema) throw new Error(`Unknown collection: ${name}`);

      setState("collections", name, "loading", true);
      setState("collections", name, "error", null);

      try {
        const files = await client.listCollection(name);
        const items: ContentItem[] = [];

        for (const file of files) {
          if (file.type === "file" && file.name.endsWith(".json")) {
            try {
              const { data, sha } = await client.getJSON(name, file.name);
              // Parse through versioned config (auto-migrates)
              const parsed = config.parseCollection(name, data) as Record<string, unknown>;
              items.push({
                id: file.name.replace(".json", ""),
                filename: file.name,
                sha,
                data: parsed,
              });
            } catch (e) {
              console.error(`Failed to load ${file.name}:`, e);
            }
          }
        }

        setState("collections", name, "items", items);
        setState("collections", name, "loading", false);
      } catch (error) {
        setState(
          produce((s) => {
            s.collections[name].loading = false;
            s.collections[name].error =
              error instanceof Error ? error.message : "Failed to load collection";
          })
        );
        throw error;
      }
    },

    async getItem(collection: string, id: string): Promise<ContentItem> {
      if (!client) throw new Error("Not authenticated");

      const schema = config.getSchema(collection);
      if (!schema) throw new Error(`Unknown collection: ${collection}`);

      const filename = `${id}.json`;
      const { data, sha } = await client.getJSON(collection, filename);
      const parsed = config.parseCollection(collection, data) as Record<string, unknown>;

      return {
        id,
        filename,
        sha,
        data: parsed,
      };
    },

    async saveItem(collection: string, data: Record<string, unknown>, existingSha?: string) {
      if (!client) throw new Error("Not authenticated");

      const schema = config.getSchema(collection);
      if (!schema) throw new Error(`Unknown collection: ${collection}`);

      // Validate data against current schema
      const parsed = config.parseCollection(collection, data) as Record<string, unknown>;
      const filename = getFilename(collection, parsed);
      const message = existingSha
        ? `Update ${collection}/${filename}`
        : `Create ${collection}/${filename}`;

      const { sha } = await client.saveJSON(collection, filename, parsed, message, existingSha);

      // Update local state
      const id = filename.replace(".json", "");
      setState(
        "collections",
        collection,
        "items",
        produce((items) => {
          const index = items.findIndex((item) => item.id === id);
          const newItem: ContentItem = { id, filename, sha, data: parsed };
          if (index >= 0) {
            items[index] = newItem;
          } else {
            items.push(newItem);
          }
        })
      );
    },

    async deleteItem(collection: string, id: string, sha: string) {
      if (!client) throw new Error("Not authenticated");

      const filename = `${id}.json`;
      const message = `Delete ${collection}/${filename}`;

      await client.deleteFile(collection, filename, message, sha);

      setState(
        "collections",
        collection,
        "items",
        produce((items) => {
          const index = items.findIndex((item) => item.id === id);
          if (index >= 0) {
            items.splice(index, 1);
          }
        })
      );
    },

    async uploadFile(file: File, fieldPath?: string): Promise<string> {
      if (!client) throw new Error("Not authenticated");
      const uploadPath = fieldPath ? `uploads/${fieldPath}` : "uploads";
      const { url } = await client.uploadFile(file, uploadPath);
      return url;
    },

    async loadMedia(): Promise<void> {
      if (!client) throw new Error("Not authenticated");

      setState("media", "loading", true);
      setState("media", "error", null);

      try {
        const uploadsPath = `${github.contentPath || "content"}/uploads`;
        const files = await client.listFolder(uploadsPath, true);

        const mediaFiles: MediaFile[] = files
          .filter((f) => f.type === "file")
          .map((f) => ({
            name: f.name,
            path: f.path,
            sha: f.sha,
            size: f.size,
            url: `https://raw.githubusercontent.com/${github.owner}/${github.repo}/${github.branch || "main"}/${f.path}`,
          }));

        setState("media", "files", mediaFiles);
        setState("media", "loading", false);
      } catch (error) {
        setState(
          produce((s) => {
            s.media.loading = false;
            s.media.error = error instanceof Error ? error.message : "Failed to load media";
          })
        );
        throw error;
      }
    },

    getMediaReferences(url: string): Array<{ collection: string; id: string; field: string }> {
      const references: Array<{ collection: string; id: string; field: string }> = [];

      for (const collectionName of collections) {
        const mediaFields = getMediaFields(collectionName);
        const items = state.collections[collectionName]?.items || [];

        for (const item of items) {
          for (const field of mediaFields) {
            if (item.data[field] === url) {
              references.push({ collection: collectionName, id: item.id, field });
            }
          }
        }
      }

      return references;
    },

    async deleteMedia(url: string, path: string, sha: string): Promise<void> {
      if (!client) throw new Error("Not authenticated");

      // Find and update all references
      const references = actions.getMediaReferences(url);

      for (const ref of references) {
        const item = state.collections[ref.collection]?.items.find((i) => i.id === ref.id);
        if (!item) continue;

        // Create updated data with field set to undefined
        const updatedData = { ...item.data, [ref.field]: undefined };

        // Save the updated item
        await actions.saveItem(ref.collection, updatedData, item.sha);
      }

      // Delete the media file
      await client.deleteFileByPath(path, `Delete media: ${path}`, sha);

      // Remove from local state
      setState(
        "media",
        "files",
        produce((files) => {
          const index = files.findIndex((f) => f.path === path);
          if (index >= 0) {
            files.splice(index, 1);
          }
        })
      );
    },

    setCurrentView(view: "collections" | "media") {
      setState("currentView", view);
      if (view === "media") {
        setState("currentCollection", null);
        setState("currentItem", null);
      }
    },

    setCurrentCollection(name: string | null) {
      setState("currentView", "collections");
      setState("currentCollection", name);
      setState("currentItem", null);
    },

    setCurrentItem(id: string | null) {
      setState("currentItem", id);
    },
  };

  // Try to restore session on init
  const savedToken = tokenStorage.get();
  if (savedToken) {
    actions.loginWithToken(savedToken).catch(() => {
      tokenStorage.remove();
    });
  }

  return [state, actions];
}

/**
 * Context for providing CMS store to components
 */
const CMSContext = createContext<CMSStore>();

export function CMSProvider(props: {
  config: VersionedConfig;
  github: GitHubConfig;
  children: JSX.Element;
}) {
  const store = createCMSStore({ config: props.config, github: props.github });

  return (
    <CMSContext.Provider value={store}>{props.children}</CMSContext.Provider>
  );
}

export function useCMS(): CMSStore {
  const context = useContext(CMSContext);
  if (!context) {
    throw new Error("useCMS must be used within a CMSProvider");
  }
  return context;
}
