import { Show, Match, Switch } from "solid-js";
import { useCMS, CMSProvider, type CMSConfig } from "../store";
import { Auth } from "./Auth";
import { CollectionList } from "./CollectionList";
import { ItemList } from "./ItemList";
import { Editor } from "./Editor";

interface CMSAppProps {
  config: CMSConfig;
}

/**
 * Main CMS layout component
 */
function CMSLayout(props: { config: CMSConfig }) {
  const [state, actions] = useCMS();

  const currentCollectionConfig = () =>
    state.currentCollection
      ? props.config.collections[state.currentCollection]
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
          <CollectionList collections={props.config.collections} />
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
            {/* Show editor when item is selected */}
            <Match when={state.currentItem && currentCollectionConfig()}>
              <Editor
                collection={currentCollectionConfig()!}
                collectionKey={state.currentCollection!}
                itemId={state.currentItem!}
              />
            </Match>

            {/* Show item list when collection is selected */}
            <Match when={state.currentCollection && currentCollectionConfig()}>
              <ItemList
                collection={currentCollectionConfig()!}
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
export function CMS(props: CMSAppProps) {
  return (
    <CMSProvider config={props.config}>
      <CMSInner config={props.config} />
    </CMSProvider>
  );
}

function CMSInner(props: { config: CMSConfig }) {
  const [state] = useCMS();

  return (
    <Show when={state.authenticated} fallback={<Auth />}>
      <CMSLayout config={props.config} />
    </Show>
  );
}
