import { Match, Show, Switch, createSignal } from 'solid-js'
import { useCMS } from './context'

/**
 * Authentication component with Device Flow OAuth support
 */
export function Auth() {
  const [state, actions] = useCMS()
  const [tokenInput, setTokenInput] = createSignal('')
  // Default to token mode since Device Flow requires a proxy for browsers
  const [useToken, setUseToken] = createSignal(true)

  const handleTokenSubmit = async (e: Event) => {
    e.preventDefault()
    const token = tokenInput().trim()
    if (token) {
      await actions.loginWithToken(token)
    }
  }

  return (
    <div class="auth">
      <div class="auth-container">
        <h1 class="auth-title">Plasticine CMS</h1>
        <p class="auth-subtitle">Git-based content management</p>

        <Show when={state.authError}>
          <div class="auth-error">{state.authError}</div>
        </Show>

        <Switch>
          <Match when={useToken()}>
            <form onSubmit={handleTokenSubmit} class="token-form">
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
                disabled={state.authLoading}
              />

              <button
                type="submit"
                class="btn btn-primary"
                disabled={state.authLoading || !tokenInput().trim()}
              >
                {state.authLoading ? 'Verifying...' : 'Login'}
              </button>
            </form>
          </Match>
        </Switch>
      </div>
    </div>
  )
}
