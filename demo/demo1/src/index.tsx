/* @refresh reload */
import { CMS, github } from '@plasticine/core'
import '@plasticine/core/styles.css'
import { Route, Router } from '@solidjs/router'
import { render } from 'solid-js/web'
import 'solid-devtools'
import config from '../config'
import App from './App'

const backend = github({
  owner: import.meta.env.VITE_GITHUB_OWNER || 'bigmistqke',
  repo: import.meta.env.VITE_GITHUB_REPO || 'plasticine-cms',
  branch: import.meta.env.VITE_GITHUB_BRANCH || 'main',
  contentPath: import.meta.env.VITE_GITHUB_CONTENT_PATH || 'demo/demo1/content',
})

const root = document.getElementById('root')

if (import.meta.env.DEV && !(root instanceof HTMLElement)) {
  throw new Error(
    'Root element not found. Did you forget to add it to your index.html? Or maybe the id attribute got misspelled?',
  )
}

render(
  () => (
    <Router>
      <Route path="/*" component={App} />
      <Route
        path="/admin/*"
        component={() => (
          <CMS
            config={config}
            backend={backend}
            basePath="/admin"
            schemaPath={import.meta.env.VITE_SCHEMA_PATH || 'demo/demo1/config.ts'}
          />
        )}
      />
    </Router>
  ),
  root!,
)
