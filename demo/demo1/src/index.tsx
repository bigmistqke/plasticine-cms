/* @refresh reload */
import { CMS, createGithubAuth, createGithubBackend } from '@plasticine/core'
import '@plasticine/core/styles.css'
import { Route, Router } from '@solidjs/router'
import 'solid-devtools'
import { render } from 'solid-js/web'
import config from '../config'
import App from './App'

const backend = createGithubBackend({
  owner: import.meta.env.VITE_GITHUB_OWNER || 'bigmistqke',
  repo: import.meta.env.VITE_GITHUB_REPO || 'plasticine-cms',
  branch: import.meta.env.VITE_GITHUB_BRANCH || 'main',
  contentPath: import.meta.env.VITE_GITHUB_CONTENT_PATH || 'demo/demo1/content',
})

const auth = createGithubAuth()

const root = document.getElementById('root')

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  )
}

render(
  () => (
    <Router base="plasticine-cms">
      <Route path="/*" component={App} />
      <Route
        path="/admin/*"
        component={() => (
          <CMS
            config={config}
            backend={backend}
            auth={auth}
            schemaPath={import.meta.env.VITE_SCHEMA_PATH || 'demo/demo1/config.ts'}
          />
        )}
      />
    </Router>
  ),
  root!,
)
