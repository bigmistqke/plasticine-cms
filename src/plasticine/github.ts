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
    const path = this.buildPath(collection);
    const url = `${GITHUB_API}/repos/${this.config.owner}/${this.config.repo}/contents/${path}?ref=${this.config.branch}`;

    const response = await fetch(url, { headers: this.headers });

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error(`Failed to list collection: ${response.statusText}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
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

    const body: Record<string, string> = {
      message,
      content: btoa(content),
      branch: this.config.branch!,
    };

    if (sha) {
      body.sha = sha;
    }

    const response = await fetch(url, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to save file: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return { sha: data.content.sha };
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
   * Delete a file
   */
  async deleteFile(
    collection: string,
    filename: string,
    message: string,
    sha: string
  ): Promise<void> {
    const path = this.buildPath(collection, filename);
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
