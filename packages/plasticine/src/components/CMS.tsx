import { Show, Match, Switch } from "solid-js";
import { useCMS, CMSProvider, type BackendFactory } from "../store";
import type { VersionedConfig } from "../schema";
import { Auth } from "./Auth";
import { CollectionList } from "./CollectionList";
import { ItemList } from "./ItemList";
import { Editor } from "./Editor";
import { MediaLibrary } from "./MediaLibrary";

interface CMSProps {
  config: VersionedConfig;
  backend: BackendFactory;
}

/**
 * Main CMS layout component
 */
function CMSLayout(props: { config: VersionedConfig }) {
  const [state, actions] = useCMS();

  const currentSchema = () =>
    state.currentCollection
      ? props.config.getSchema(state.currentCollection)
      : null;

  return (
    <div class="cms-layout">
      {/* Header */}
      <header class="cms-header">
        <h1 class="cms-logo">Plasticine</h1>
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
              <li
                class="media-nav-item"
                classList={{ active: state.currentView === "media" }}
                onClick={() => actions.setCurrentView("media")}
              >
                <span class="media-nav-name">Library</span>
                <span class="media-nav-count">{state.media.files.length}</span>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Main content */}
        <main class="cms-main">
          <Switch
            fallback={
              <div class="cms-welcome">
                <h2>Welcome to Plasticine</h2>
                <p>Select a collection from the sidebar to get started.</p>
              </div>
            }
          >
            {/* Show media library */}
            <Match when={state.currentView === "media"}>
              <MediaLibrary />
            </Match>

            {/* Show editor when item is selected */}
            <Match when={state.currentItem && currentSchema()}>
              <Editor
                schema={currentSchema()!}
                collectionKey={state.currentCollection!}
                itemId={state.currentItem!}
              />
            </Match>

            {/* Show item list when collection is selected */}
            <Match when={state.currentCollection}>
              <ItemList
                collectionKey={state.currentCollection!}
              />
            </Match>
          </Switch>
        </main>
      </div>
    </div>
  );
}

/**
 * Full CMS application with auth gate
 */
export function CMS(props: CMSProps) {
  return (
    <CMSProvider config={props.config} backend={props.backend}>
      <CMSInner config={props.config} />
    </CMSProvider>
  );
}

function CMSInner(props: { config: VersionedConfig }) {
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
        <CMSLayout config={props.config} />
      </Show>
    </Show>
  );
}
