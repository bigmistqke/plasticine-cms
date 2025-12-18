/**
 * Backend interfaces for content and media storage.
 * GitHub implements both, but other backends could split them
 * (e.g., MongoDB for content + S3 for media).
 */

export interface ContentItem {
  id: string;
  sha?: string; // For backends that need version/etag tracking
  data: Record<string, unknown>;
}

export interface ContentBackend {
  listCollection(collection: string): Promise<ContentItem[]>;
  getItem(collection: string, id: string): Promise<ContentItem>;
  saveItem(
    collection: string,
    id: string,
    data: Record<string, unknown>,
    sha?: string
  ): Promise<{ sha?: string }>;
  deleteItem(collection: string, id: string, sha?: string): Promise<void>;
}

export interface MediaFile {
  name: string;
  path: string;
  sha?: string;
  url: string;
  size: number;
}

export interface MediaBackend {
  listMedia(): Promise<MediaFile[]>;
  uploadFile(file: File, folder?: string): Promise<{ url: string; sha?: string }>;
  deleteFile(path: string, sha?: string): Promise<void>;
}

export interface Backend {
  content: ContentBackend;
  media: MediaBackend;
}
