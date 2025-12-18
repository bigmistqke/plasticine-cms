import { createSignal, createContext, useContext, type JSX } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type * as v from "valibot";
import {
  GitHubClient,
  tokenStorage,
  type GitHubConfig,
  type DeviceCodeResponse,
} from "./github";
import type { VersionedSchema } from "./schema";

/**
 * CMS Store Types
 */

export interface CollectionConfig {
  name: string;
  schema: VersionedSchema<any, v.GenericSchema>;
  filenameField?: string; // Field to use for filename, defaults to 'slug' or 'id'
}

export interface CMSConfig {
  github: GitHubConfig;
  collections: Record<string, CollectionConfig>;
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

export interface CMSState {
  // Auth
  authenticated: boolean;
  user: { login: string; avatar_url: string; name: string } | null;
  authLoading: boolean;
  authError: string | null;
  deviceCode: DeviceCodeResponse | null;

  // Collections
  collections: Record<string, CollectionState>;

  // Current editing
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
  uploadFile(file: File): Promise<string>;

  // Navigation
  setCurrentCollection(name: string | null): void;
  setCurrentItem(id: string | null): void;
}

export type CMSStore = [CMSState, CMSActions];

/**
 * Create the CMS store
 */
export function createCMSStore(config: CMSConfig): CMSStore {
  let client: GitHubClient | null = null;

  const [state, setState] = createStore<CMSState>({
    authenticated: false,
    user: null,
    authLoading: false,
    authError: null,
    deviceCode: null,
    collections: Object.fromEntries(
      Object.keys(config.collections).map((name) => [
        name,
        { items: [], loading: false, error: null },
      ])
    ),
    currentCollection: null,
    currentItem: null,
  });

  const getFilenameField = (collection: string): string => {
    return config.collections[collection]?.filenameField || "slug";
  };

  const getFilename = (collection: string, data: Record<string, unknown>): string => {
    const field = getFilenameField(collection);
    const value = data[field];
    if (typeof value === "string" && value) {
      return `${value}.json`;
    }
    // Fallback to timestamp-based ID
    return `${Date.now()}.json`;
  };

  const actions: CMSActions = {
    async loginWithToken(token: string) {
      setState("authLoading", true);
      setState("authError", null);

      try {
        client = new GitHubClient(token, config.github);
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

      const collectionConfig = config.collections[name];
      if (!collectionConfig) throw new Error(`Unknown collection: ${name}`);

      setState("collections", name, "loading", true);
      setState("collections", name, "error", null);

      try {
        const files = await client.listCollection(name);
        const items: ContentItem[] = [];

        for (const file of files) {
          if (file.type === "file" && file.name.endsWith(".json")) {
            try {
              const { data, sha } = await client.getJSON(name, file.name);
              // Parse through versioned schema (auto-migrates)
              const parsed = collectionConfig.schema.parse(data) as Record<string, unknown>;
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

      const collectionConfig = config.collections[collection];
      if (!collectionConfig) throw new Error(`Unknown collection: ${collection}`);

      const filename = `${id}.json`;
      const { data, sha } = await client.getJSON(collection, filename);
      const parsed = collectionConfig.schema.parse(data) as Record<string, unknown>;

      return {
        id,
        filename,
        sha,
        data: parsed,
      };
    },

    async saveItem(collection: string, data: Record<string, unknown>, existingSha?: string) {
      if (!client) throw new Error("Not authenticated");

      const collectionConfig = config.collections[collection];
      if (!collectionConfig) throw new Error(`Unknown collection: ${collection}`);

      // Validate data against current schema
      const parsed = collectionConfig.schema.parse(data) as Record<string, unknown>;
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

    async uploadFile(file: File): Promise<string> {
      if (!client) throw new Error("Not authenticated");
      const { url } = await client.uploadFile(file);
      return url;
    },

    setCurrentCollection(name: string | null) {
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
  config: CMSConfig;
  children: JSX.Element;
}) {
  const store = createCMSStore(props.config);

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
