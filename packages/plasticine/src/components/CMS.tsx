import { Show, Match, Switch } from "solid-js";
import { useCMS, CMSProvider } from "../store";
import type { VersionedConfig } from "../schema";
import type { GitHubConfig } from "../github";
import { Auth } from "./Auth";
import { CollectionList } from "./CollectionList";
import { ItemList } from "./ItemList";
import { Editor } from "./Editor";

interface CMSProps {
  config: VersionedConfig;
  github: GitHubConfig;
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
    <CMSProvider config={props.config} github={props.github}>
      <CMSInner config={props.config} />
    </CMSProvider>
  );
}

function CMSInner(props: { config: VersionedConfig }) {
  const [state] = useCMS();

  return (
    <Show when={state.authenticated} fallback={<Auth />}>
      <CMSLayout config={props.config} />
    </Show>
  );
}
