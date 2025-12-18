/**
 * GitHub API client with Device Flow OAuth
 */

const GITHUB_API = "https://api.github.com";
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";

export interface GitHubConfig {
  owner: string;
  repo: string;
  branch?: string;
  contentPath?: string;
}

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: "file" | "dir";
  download_url: string | null;
}

export interface GitHubContent {
  content: string;
  encoding: string;
  sha: string;
  path: string;
}

/**
 * Start Device Flow OAuth
 * Returns device code info for user to authenticate
 */
export async function startDeviceFlow(
  clientId: string
): Promise<DeviceCodeResponse> {
  const response = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      scope: "repo",
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start device flow: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Poll for access token after user authenticates
 */
export async function pollForToken(
  clientId: string,
  deviceCode: string,
  interval: number,
  onPoll?: () => void
): Promise<TokenResponse> {
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));
    onPoll?.();

    const response = await fetch(GITHUB_ACCESS_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    const data = await response.json();

    if (data.access_token) {
      return data as TokenResponse;
    }

    if (data.error === "authorization_pending") {
      continue;
    }

    if (data.error === "slow_down") {
      interval = data.interval || interval + 5;
      continue;
    }

    if (data.error === "expired_token") {
      throw new Error("Device code expired. Please try again.");
    }

    if (data.error === "access_denied") {
      throw new Error("Access denied by user.");
    }

    throw new Error(`OAuth error: ${data.error}`);
  }
}

/**
 * GitHub API client for content management
 */
export class GitHubClient {
  private token: string;
  private config: GitHubConfig;

  constructor(token: string, config: GitHubConfig) {
    this.token = token;
    this.config = {
      branch: "main",
      contentPath: "content",
      ...config,
    };
  }

  private get headers() {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  private buildPath(collection: string, filename?: string): string {
    const parts = [this.config.contentPath, collection];
    if (filename) {
      parts.push(filename);
    }
    return parts.filter(Boolean).join("/");
  }

  /**
   * List files in a collection
   */
  async listCollection(collection: string): Promise<GitHubFile[]> {
    return this.listFolder(this.buildPath(collection));
  }

  /**
   * List files in any folder path (relative to repo root)
   * Optionally recurses into subdirectories
   */
  async listFolder(folderPath: string, recursive = false): Promise<GitHubFile[]> {
    const url = `${GITHUB_API}/repos/${this.config.owner}/${this.config.repo}/contents/${folderPath}?ref=${this.config.branch}`;

    const response = await fetch(url, { headers: this.headers });

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error(`Failed to list folder: ${response.statusText}`);
    }

    const data = await response.json();
    const files: GitHubFile[] = Array.isArray(data) ? data : [];

    if (recursive) {
      const dirs = files.filter((f) => f.type === "dir");
      for (const dir of dirs) {
        const subFiles = await this.listFolder(dir.path, true);
        files.push(...subFiles);
      }
    }

    return files;
  }

  /**
   * Get a single file's content
   */
  async getFile(collection: string, filename: string): Promise<GitHubContent> {
    const path = this.buildPath(collection, filename);
    const url = `${GITHUB_API}/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`;

    const response = await fetch(url, { headers: this.headers });

    if (!response.ok) {
      throw new Error(`Failed to get file: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get and parse JSON content
   */
  async getJSON<T>(collection: string, filename: string): Promise<{ data: T; sha: string }> {
    const content = await this.getFile(collection, filename);
    const decoded = atob(content.content);
    return {
      data: JSON.parse(decoded) as T,
      sha: content.sha,
    };
  }

  /**
   * Create or update a file
   */
  async saveFile(
    collection: string,
    filename: string,
    content: string,
    message: string,
    sha?: string
  ): Promise<{ sha: string }> {
    const path = this.buildPath(collection, filename);
    const url = `${GITHUB_API}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;

    // Retry logic for 409 conflicts
    const maxRetries = 3;
    let currentSha = sha;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        // Wait briefly before retry
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));

        // If we have a SHA conflict, try to fetch the current SHA
        if (currentSha) {
          try {
            const current = await this.getFile(collection, filename);
            currentSha = current.sha;
          } catch {
            // File might not exist, continue without SHA
            currentSha = undefined;
          }
        }
      }

      const body: Record<string, string> = {
        message,
        content: btoa(content),
        branch: this.config.branch!,
      };

      if (currentSha) {
        body.sha = currentSha;
      }

      const response = await fetch(url, {
        method: "PUT",
        headers: this.headers,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        return { sha: data.content.sha };
      }

      const error = await response.json();

      // Retry on 409 conflict
      if (response.status === 409 && attempt < maxRetries - 1) {
        lastError = new Error(error.message || response.statusText);
        continue;
      }

      throw new Error(`Failed to save file: ${error.message || response.statusText}`);
    }

    throw lastError || new Error("Failed to save file after retries");
  }

  /**
   * Save JSON content
   */
  async saveJSON<T>(
    collection: string,
    filename: string,
    data: T,
    message: string,
    sha?: string
  ): Promise<{ sha: string }> {
    const content = JSON.stringify(data, null, 2);
    return this.saveFile(collection, filename, content, message, sha);
  }

  /**
   * Upload a binary file (image, etc.)
   * Returns the raw GitHub URL for the uploaded file
   */
  async uploadFile(
    file: File,
    folder: string = "uploads"
  ): Promise<{ url: string; sha: string }> {
    // Generate unique filename
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${timestamp}-${safeName}`;
    const path = `${this.config.contentPath}/${folder}/${filename}`;

    // Convert file to base64
    const base64 = await this.fileToBase64(file);

    const url = `${GITHUB_API}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;

    // Retry logic for 409 conflicts (branch was updated by concurrent operation)
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        // Wait briefly before retry to let GitHub settle
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }

      const response = await fetch(url, {
        method: "PUT",
        headers: this.headers,
        body: JSON.stringify({
          message: `Upload ${file.name}`,
          content: base64,
          branch: this.config.branch,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Return raw GitHub URL for the file
        const rawUrl = `https://raw.githubusercontent.com/${this.config.owner}/${this.config.repo}/${this.config.branch}/${path}`;

        return { url: rawUrl, sha: data.content.sha };
      }

      const error = await response.json();

      // Retry on 409 conflict (branch state changed)
      if (response.status === 409 && attempt < maxRetries - 1) {
        lastError = new Error(error.message || response.statusText);
        continue;
      }

      throw new Error(`Failed to upload file: ${error.message || response.statusText}`);
    }

    throw lastError || new Error("Failed to upload file after retries");
  }

  /**
   * Convert File to base64 string (without data URL prefix)
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Delete a file in a collection
   */
  async deleteFile(
    collection: string,
    filename: string,
    message: string,
    sha: string
  ): Promise<void> {
    const path = this.buildPath(collection, filename);
    await this.deleteFileByPath(path, message, sha);
  }

  /**
   * Delete a file by its full path
   */
  async deleteFileByPath(
    path: string,
    message: string,
    sha: string
  ): Promise<void> {
    const url = `${GITHUB_API}/repos/${this.config.owner}/${this.config.repo}/contents/${path}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers: this.headers,
      body: JSON.stringify({
        message,
        sha,
        branch: this.config.branch,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to delete file: ${error.message || response.statusText}`);
    }
  }

  /**
   * Check if content directory exists, create if not
   */
  async ensureContentDirectory(): Promise<void> {
    const url = `${GITHUB_API}/repos/${this.config.owner}/${this.config.repo}/contents/${this.config.contentPath}?ref=${this.config.branch}`;

    const response = await fetch(url, { headers: this.headers });

    if (response.status === 404) {
      // Create a .gitkeep file to initialize the directory
      await this.saveFile("", ".gitkeep", "", "Initialize content directory");
    }
  }

  /**
   * Verify token and get user info
   */
  async getUser(): Promise<{ login: string; avatar_url: string; name: string }> {
    const response = await fetch(`${GITHUB_API}/user`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error("Invalid token or API error");
    }

    return response.json();
  }
}

/**
 * Storage helpers for persisting auth
 */
export const tokenStorage = {
  key: "plasticine_github_token",

  get(): string | null {
    return localStorage.getItem(this.key);
  },

  set(token: string): void {
    localStorage.setItem(this.key, token);
  },

  remove(): void {
    localStorage.removeItem(this.key);
  },
};
