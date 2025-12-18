import { createResource, For, Show, Suspense } from "solid-js";
import config from "../plasticine/config";

const GITHUB_RAW = `https://raw.githubusercontent.com/${
  import.meta.env.VITE_GITHUB_OWNER || "bigmistqke"
}/${import.meta.env.VITE_GITHUB_REPO || "plasticine-cms"}/${
  import.meta.env.VITE_GITHUB_BRANCH || "main"
}/${import.meta.env.VITE_GITHUB_CONTENT_PATH || "demo/demo1/content"}`;

interface Author {
  slug: string;
  name: string;
  bio?: string;
  avatar?: string;
}

interface Post {
  slug: string;
  title: string;
  content: string;
  cover?: string;
  author?: string;
  draft: boolean;
  publishedAt?: string;
}

async function fetchCollection<T>(name: string): Promise<T[]> {
  // Fetch the directory listing via GitHub API
  const apiUrl = `https://api.github.com/repos/${
    import.meta.env.VITE_GITHUB_OWNER || "bigmistqke"
  }/${import.meta.env.VITE_GITHUB_REPO || "plasticine-cms"}/contents/${
    import.meta.env.VITE_GITHUB_CONTENT_PATH || "demo/demo1/content"
  }/${name}`;

  const response = await fetch(apiUrl);
  if (!response.ok) return [];

  const files = await response.json();
  const items: T[] = [];

  for (const file of files) {
    if (file.name.endsWith(".json")) {
      const contentRes = await fetch(file.download_url);
      if (contentRes.ok) {
        const data = await contentRes.json();
        // Parse through config to apply migrations
        const parsed = config.parseCollection(name, data);
        items.push(parsed as T);
      }
    }
  }

  return items;
}

function PostCard(props: { post: Post; authors: Author[] }) {
  const author = () => props.authors.find((a) => a.slug === props.post.author);

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
          <time class="post-date">
            {new Date(props.post.publishedAt!).toLocaleDateString()}
          </time>
        </Show>
        <div class="post-excerpt">
          {props.post.content.slice(0, 200)}...
        </div>
      </div>
    </article>
  );
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
  );
}

export default function App() {
  const [posts] = createResource(() => fetchCollection<Post>("posts"));
  const [authors] = createResource(() => fetchCollection<Author>("authors"));

  const publishedPosts = () =>
    (posts() || []).filter((p) => !p.draft).sort((a, b) => {
      if (!a.publishedAt || !b.publishedAt) return 0;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });

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
            <Show
              when={publishedPosts().length > 0}
              fallback={<p>No posts yet.</p>}
            >
              <div class="posts-grid">
                <For each={publishedPosts()}>
                  {(post) => <PostCard post={post} authors={authors() || []} />}
                </For>
              </div>
            </Show>
          </Suspense>
        </section>

        <section id="authors" class="section">
          <h2>Authors</h2>
          <Suspense fallback={<p>Loading authors...</p>}>
            <Show
              when={(authors() || []).length > 0}
              fallback={<p>No authors yet.</p>}
            >
              <div class="authors-grid">
                <For each={authors()}>
                  {(author) => <AuthorCard author={author} />}
                </For>
              </div>
            </Show>
          </Suspense>
        </section>
      </main>

      <footer class="footer">
        <p>Powered by Plasticine CMS</p>
      </footer>

      <style>{`
        .app {
          font-family: system-ui, -apple-system, sans-serif;
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 3rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #eee;
        }

        .header nav {
          display: flex;
          gap: 1.5rem;
        }

        .header nav a {
          color: #666;
          text-decoration: none;
        }

        .header nav a:hover {
          color: #000;
        }

        .section {
          margin-bottom: 4rem;
        }

        .section h2 {
          margin-bottom: 1.5rem;
        }

        .posts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 2rem;
        }

        .post-card {
          border: 1px solid #eee;
          border-radius: 8px;
          overflow: hidden;
        }

        .post-cover {
          width: 100%;
          height: 200px;
          object-fit: cover;
        }

        .post-content {
          padding: 1.5rem;
        }

        .post-title {
          margin: 0 0 0.5rem;
          font-size: 1.25rem;
        }

        .post-author {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
          color: #666;
        }

        .author-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
        }

        .post-date {
          display: block;
          font-size: 0.75rem;
          color: #999;
          margin-bottom: 0.75rem;
        }

        .post-excerpt {
          color: #666;
          font-size: 0.875rem;
          line-height: 1.5;
        }

        .authors-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1.5rem;
        }

        .author-card {
          text-align: center;
          padding: 1.5rem;
          border: 1px solid #eee;
          border-radius: 8px;
        }

        .author-avatar-large {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          margin-bottom: 1rem;
        }

        .author-card h3 {
          margin: 0 0 0.5rem;
        }

        .author-card p {
          color: #666;
          font-size: 0.875rem;
          margin: 0;
        }

        .footer {
          margin-top: 4rem;
          padding-top: 2rem;
          border-top: 1px solid #eee;
          text-align: center;
          color: #999;
        }
      `}</style>
    </div>
  );
}
