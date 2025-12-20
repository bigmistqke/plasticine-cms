import { createSignal, Show } from 'solid-js'
import type { AuthProvider, AuthResult, User } from './types'

const GITHUB_API = 'https://api.github.com'
const TOKEN_STORAGE_KEY = 'plasticine_token'

export interface GitHubAuthConfig {
  /** GitHub OAuth App client ID (optional, for device flow) */
  clientId?: string
}

/**
 * Get user info from GitHub API
 */
async function getUser(token: string): Promise<User> {
  const response = await fetch(`${GITHUB_API}/user`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    throw new Error('Invalid token or API error')
  }

  return response.json()
}

/**
 * Create a GitHub auth provider
 */
export function createGithubAuth(_config?: GitHubAuthConfig): AuthProvider {
  const tokenStorage = {
    get: () => localStorage.getItem(TOKEN_STORAGE_KEY),
    set: (token: string) => localStorage.setItem(TOKEN_STORAGE_KEY, token),
    remove: () => localStorage.removeItem(TOKEN_STORAGE_KEY),
  }

  return {
    async checkAuth(): Promise<AuthResult | null> {
      const token = tokenStorage.get()
      if (!token) return null

      try {
        const user = await getUser(token)
        return { user, token }
      } catch {
        tokenStorage.remove()
        return null
      }
    },

    async logout(): Promise<void> {
      tokenStorage.remove()
    },

    LoginScreen(props: { onSuccess: (result: AuthResult) => void }) {
      const [tokenInput, setTokenInput] = createSignal('')
      const [loading, setLoading] = createSignal(false)
      const [error, setError] = createSignal<string | null>(null)

      const handleSubmit = async (e: Event) => {
        e.preventDefault()
        const token = tokenInput().trim()
        if (!token) return

        setLoading(true)
        setError(null)

        try {
          const user = await getUser(token)
          tokenStorage.set(token)
          props.onSuccess({ user, token })
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Authentication failed')
        } finally {
          setLoading(false)
        }
      }

      return (
        <div class="auth">
          <div class="auth-container">
            <h1 class="auth-title">Plasticine CMS</h1>
            <p class="auth-subtitle">Git-based content management</p>

            <Show when={error()}>
              <div class="auth-error">{error()}</div>
            </Show>

            <form onSubmit={handleSubmit} class="token-form">
              <p class="token-instructions">
                Create a{' '}
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=Plasticine%20CMS"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Personal Access Token
                </a>{' '}
                with <code>repo</code> scope.
              </p>

              <input
                type="password"
                class="input"
                placeholder="ghp_xxxxxxxxxxxx"
                value={tokenInput()}
                onInput={e => setTokenInput(e.currentTarget.value)}
                disabled={loading()}
              />

              <button
                type="submit"
                class="btn btn-primary"
                disabled={loading() || !tokenInput().trim()}
              >
                {loading() ? 'Verifying...' : 'Login'}
              </button>
            </form>
          </div>
        </div>
      )
    },
  }
}
