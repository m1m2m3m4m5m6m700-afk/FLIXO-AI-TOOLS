export interface GitHubClientOptions {
  token: string;
  apiBaseUrl?: string;
}

export class GitHubApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details: unknown = null) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.details = details;
  }
}

export interface GitHubClient {
  request<T>(path: string, init?: RequestInit): Promise<T>;
}

function assertServerOnly(): void {
  if (typeof window !== 'undefined') {
    throw new Error('GitHub server client must not be imported or executed in a browser context');
  }
}

export function createGitHubClient({ token, apiBaseUrl = 'https://api.github.com' }: GitHubClientOptions): GitHubClient {
  assertServerOnly();
  if (!token.trim()) throw new Error('GitHub token is required');

  return {
    async request<T>(path, init = {}) {
      const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, {
        ...init,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.headers ?? {}),
        },
      });

      const contentType = response.headers.get('content-type') ?? '';
      const payload = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        const message = typeof payload === 'object' && payload && 'message' in payload
          ? String(payload.message)
          : `GitHub API request failed with ${response.status}`;
        throw new GitHubApiError(message, response.status, payload);
      }

      return payload as T;
    },
  };
}
