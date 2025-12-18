import { A, Route, Router, useParams } from "@solidjs/router";
import { Show, type JSX } from "solid-js";
import { type BackendFactory } from "./backend/types";
import { Auth } from "./components/Auth";
import { CollectionList } from "./components/CollectionList";
import { Editor } from "./components/Editor";
import { ItemList } from "./components/ItemList";
import { MediaLibrary } from "./components/MediaLibrary";
import { SchemaEditor } from "./components/SchemaEditor";
import type { PlasticineConfig } from "./config/define-config";
import { CMSProvider, useCMS } from "./context";

interface CMSProps {
  config: PlasticineConfig;
  backend: BackendFactory;
  schemaPath?: string;
  basePath?: string;
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
  );
}

/**
 * Route component for editing an item
 */
function EditorRoute(props: { config: PlasticineConfig }) {
  const params = useParams<{ collection: string; item: string }>();
  const schema = () => props.config.getSchema(params.collection);

  return (
    <Show when={schema()} fallback={<div>Collection not found</div>}>
      <Editor
        schema={schema()!}
        collectionKey={params.collection}
        itemId={params.item}
      />
    </Show>
  );
}

/**
 * Route component for item list
 */
function ItemListRoute() {
  const params = useParams<{ collection: string }>();
  return <ItemList collectionKey={params.collection} />;
}

/**
 * Main CMS layout component - wraps route content
 */
function CMSLayout(props: {
  config: PlasticineConfig;
  children?: JSX.Element;
}) {
  const [state, actions] = useCMS();

  return (
    <div class="cms-layout">
      {/* Header */}
      <header class="cms-header">
        <A href="/" class="cms-logo">
          Plasticine
        </A>
        <Show when={state.user}>
          <div class="cms-user">
            <img
              src={state.user!.avatar_url}
              alt={state.user!.login}
              class="cms-avatar"
            />
            <span class="cms-username">{state.user!.login}</span>
            <button class="btn btn-small" onClick={() => actions.logout()}>
              Logout
            </button>
          </div>
        </Show>
      </header>

      <div class="cms-body">
        {/* Sidebar */}
        <aside class="cms-sidebar">
          <CollectionList collections={props.config.getCollections()} />

          {/* Media section */}
          <nav class="media-nav">
            <h2 class="media-nav-title">Media</h2>
            <ul class="media-nav-items">
              <A href="/media" class="media-nav-item" activeClass="active">
                <span class="media-nav-name">Library</span>
                <span class="media-nav-count">{state.media.files.length}</span>
              </A>
            </ul>
          </nav>

          {/* Schema section */}
          <nav class="schema-nav">
            <h2 class="schema-nav-title">Settings</h2>
            <ul class="schema-nav-items">
              <A href="/schema" class="schema-nav-item" activeClass="active">
                <span class="schema-nav-name">Schema</span>
              </A>
            </ul>
          </nav>
        </aside>

        {/* Main content - renders nested routes */}
        <main class="cms-main">{props.children}</main>
      </div>
    </div>
  );
}

/**
 * Auth gate wrapper component
 */
function AuthGate(props: { config: PlasticineConfig; children: any }) {
  const [state] = useCMS();

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
        <CMSLayout config={props.config}>{props.children}</CMSLayout>
      </Show>
    </Show>
  );
}

/**
 * Full CMS application with auth gate
 */
export function CMS(props: CMSProps) {
  return (
    <Router
      base={props.basePath}
      root={(routeProps) => (
        <CMSProvider
          config={props.config}
          backend={props.backend}
          schemaPath={props.schemaPath}
        >
          <AuthGate config={props.config}>{routeProps.children}</AuthGate>
        </CMSProvider>
      )}
    >
      <Route path="/" component={Welcome} />
      <Route path="/schema" component={SchemaEditor} />
      <Route path="/media" component={MediaLibrary} />
      <Route
        path="/collections/:collection/:item"
        component={() => <EditorRoute config={props.config} />}
      />
      <Route path="/collections/:collection" component={ItemListRoute} />
    </Router>
  );
}
