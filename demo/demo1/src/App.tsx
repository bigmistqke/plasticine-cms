import { createGitHubClient, Infer } from '@plasticine/core'
import { createResource, For, Show, Suspense } from 'solid-js'
import config from '../plasticine/config'
import './App.css'

// Types inferred from the schema
type Author = Infer<typeof config.collections.authors>
type Post = Infer<typeof config.collections.posts>

// Create type-safe content client
const content = createGitHubClient(config, {
  owner: import.meta.env.VITE_GITHUB_OWNER || 'bigmistqke',
  repo: import.meta.env.VITE_GITHUB_REPO || 'plasticine-cms',
  branch: import.meta.env.VITE_GITHUB_BRANCH || 'main',
  contentPath: import.meta.env.VITE_GITHUB_CONTENT_PATH || 'demo/demo1/content',
})

function PostCard(props: { post: Post; authors: Author[] }) {
  const author = () => props.authors.find(a => a.slug === props.post.author)

  return (
    <article class="post-card">
      <Show when={props.post.cover}>
        <img src={props.post.cover} alt="" class="post-cover" />
      </Show>
      <div class="post-content">
        <h2 class="post-title">{props.post.title}</h2>
        <Show when={author()}>
          <div class="post-author">
            <Show when={author()!.avatar}>
              <img src={author()!.avatar} alt="" class="author-avatar" />
            </Show>
            <span>{author()!.name}</span>
          </div>
        </Show>
        <Show when={props.post.publishedAt}>
          <time class="post-date">{new Date(props.post.publishedAt!).toLocaleDateString()}</time>
        </Show>
        <div class="post-excerpt">{props.post.content.slice(0, 200)}...</div>
      </div>
    </article>
  )
}

function AuthorCard(props: { author: Author }) {
  return (
    <div class="author-card">
      <Show when={props.author.avatar}>
        <img src={props.author.avatar} alt="" class="author-avatar-large" />
      </Show>
      <h3>{props.author.name}</h3>
      <Show when={props.author.bio}>
        <p>{props.author.bio}</p>
      </Show>
    </div>
  )
}

export default function App() {
  const [posts] = createResource(() => content.posts.getAll())
  const [authors] = createResource(() => content.authors.getAll())

  const publishedPosts = () =>
    (posts() || [])
      .map(p => p.data)
      .filter(p => !p.draft)
      .sort((a, b) => {
        if (!a.publishedAt || !b.publishedAt) return 0
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      })

  const authorsList = () => (authors() || []).map(a => a.data)

  return (
    <div class="app">
      <header class="header">
        <h1>My Blog</h1>
        <nav>
          <a href="#posts">Posts</a>
          <a href="#authors">Authors</a>
        </nav>
      </header>

      <main>
        <section id="posts" class="section">
          <h2>Latest Posts</h2>
          <Suspense fallback={<p>Loading posts...</p>}>
            <Show when={publishedPosts().length > 0} fallback={<p>No posts yet.</p>}>
              <div class="posts-grid">
                <For each={publishedPosts()}>
                  {post => <PostCard post={post} authors={authorsList()} />}
                </For>
              </div>
            </Show>
          </Suspense>
        </section>

        <section id="authors" class="section">
          <h2>Authors</h2>
          <Suspense fallback={<p>Loading authors...</p>}>
            <Show when={authorsList().length > 0} fallback={<p>No authors yet.</p>}>
              <div class="authors-grid">
                <For each={authorsList()}>{author => <AuthorCard author={author} />}</For>
              </div>
            </Show>
          </Suspense>
        </section>
      </main>

      <footer class="footer">
        <p>Powered by Plasticine CMS</p>
      </footer>
    </div>
  )
}
