import { Route, Router, useNavigate, useSearchParams } from '@solidjs/router'
import { Show } from 'solid-js'
import { type BackendFactory } from './backend/types'
import { Auth } from './components/Auth'
import { Editor } from './components/Editor'
import { ItemList } from './components/ItemList'
import { Link } from './components/Link'
import { MediaLibrary } from './components/MediaLibrary'
import { SchemaEditor } from './components/SchemaEditor'
import type { CollectionsConfig, PlasticineConfig } from './config/define-config'
import { CMSProvider, useCMS } from './context'

interface CMSProps<T extends CollectionsConfig = CollectionsConfig> {
  config: PlasticineConfig<T>
  backend: BackendFactory
  schemaPath?: string
  /** Set to true when CMS is rendered inside an existing Router */
  embedded?: boolean
}

export type CMSParams = {
  view?: string
  collection?: string
  item?: string
}

/**
 * Welcome page component
 */
function Welcome() {
  return (
    <div class="cms-welcome">
      <h2>Welcome to Plasticine</h2>
      <p>Select a collection from the sidebar to get started.</p>
    </div>
  )
}

/**
 * Main content router based on search params
 */
function CMSContent(props: { config: PlasticineConfig<any> }) {
  const [searchParams] = useSearchParams<CMSParams>()

  const schema = () =>
    searchParams.collection ? props.config.getSchema(searchParams.collection) : null

  return (
    <Show
      when={searchParams.view === 'media'}
      fallback={
        <Show
          when={searchParams.view === 'schema'}
          fallback={
            <Show when={searchParams.collection} fallback={<Welcome />}>
              <Show
                when={searchParams.item}
                fallback={<ItemList collectionKey={searchParams.collection!} />}
              >
                <Show when={schema()} fallback={<div>Collection not found</div>}>
                  <Editor
                    schema={schema()!}
                    collectionKey={searchParams.collection!}
                    itemId={searchParams.item!}
                  />
                </Show>
              </Show>
            </Show>
          }
        >
          <SchemaEditor />
        </Show>
      }
    >
      <MediaLibrary />
    </Show>
  )
}

/**
 * Sidebar collection list using search param navigation
 */
function CMSSidebar(props: { config: PlasticineConfig<any> }) {
  const [state] = useCMS()

  const displayName = (name: string) => name.charAt(0).toUpperCase() + name.slice(1)

  return (
    <aside class="cms-sidebar">
      <nav class="collection-list">
        <h2 class="collection-list-title">Collections</h2>
        <ul class="collection-list-items">
          {props.config.getCollections().map(name => (
            <Link params={{ collection: name }} class="collection-list-item" activeClass="active">
              <span class="collection-name">{displayName(name)}</span>
              <span class="collection-count">{state.collections[name]?.items.length || 0}</span>
            </Link>
          ))}
        </ul>
      </nav>

      <nav class="media-nav">
        <h2 class="media-nav-title">Media</h2>
        <ul class="media-nav-items">
          <Link params={{ view: 'media' }} class="media-nav-item" activeClass="active">
            <span class="media-nav-name">Library</span>
            <span class="media-nav-count">{state.media.files.length}</span>
          </Link>
        </ul>
      </nav>

      <nav class="schema-nav">
        <h2 class="schema-nav-title">Settings</h2>
        <ul class="schema-nav-items">
          <Link params={{ view: 'schema' }} class="schema-nav-item" activeClass="active">
            <span class="schema-nav-name">Schema</span>
          </Link>
        </ul>
      </nav>
    </aside>
  )
}

/**
 * Main CMS layout component
 */
function CMSLayout(props: { config: PlasticineConfig<any> }) {
  const [state, actions] = useCMS()

  return (
    <div class="cms-layout">
      <header class="cms-header">
        <Link params={{}} class="cms-logo">
          Plasticine
        </Link>
        <Show when={state.user}>
          <div class="cms-user">
            <img src={state.user!.avatar_url} alt={state.user!.login} class="cms-avatar" />
            <span class="cms-username">{state.user!.login}</span>
            <button class="btn btn-small" onClick={() => actions.logout()}>
              Logout
            </button>
          </div>
        </Show>
      </header>

      <div class="cms-body">
        <CMSSidebar config={props.config} />
        <main class="cms-main">
          <CMSContent config={props.config} />
        </main>
      </div>
    </div>
  )
}

/**
 * Auth gate wrapper component
 */
function AuthGate(props: { config: PlasticineConfig<any> }) {
  const [state] = useCMS()

  return (
    <Show when={state.authenticated} fallback={<Auth />}>
      <Show
        when={!state.dataLoading}
        fallback={
          <div class="cms-loading">
            <div class="cms-loading-content">
              <h2>Loading...</h2>
              <p>Fetching your content</p>
            </div>
          </div>
        }
      >
        <CMSLayout config={props.config} />
      </Show>
    </Show>
  )
}

/**
 * Inner CMS content
 */
function CMSInner<T extends CollectionsConfig>(props: CMSProps<T>) {
  return (
    <CMSProvider config={props.config} backend={props.backend} schemaPath={props.schemaPath}>
      <AuthGate config={props.config} />
    </CMSProvider>
  )
}

/**
 * CMS component - automatically wraps with Router if needed
 */
export function CMS<T extends CollectionsConfig>(props: CMSProps<T>) {
  try {
    useNavigate()
    return <CMSInner {...props} />
  } catch {
    return (
      <Router>
        <Route path="*" component={() => <CMSInner {...props} />} />
      </Router>
    )
  }
}
