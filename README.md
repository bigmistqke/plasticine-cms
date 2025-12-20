# Plasticine

A git-based headless CMS for SolidJS with type-safe content management.

## Features

- **Git-based storage** - Content stored as JSON files in your repository
- **Type-safe schemas** - Define content types with Valibot schemas
- **Schema versioning** - Migrate old content when loading
- **Media management** - Upload and manage images/files
- **Type-safe client** - Fully typed frontend API with IntelliSense
- **Embeddable** - Drop into existing SolidJS apps with @solidjs/router

## Installation

```bash
pnpm add @plasticine/core
```

## Quick Start

### 1. Define your schema

```ts
// plasticine.config.ts
import { defineConfig, schema, slug, text, textarea, image, boolean } from '@plasticine/core'
import { object, optional } from 'valibot'

export default defineConfig({
  posts: schema(
    object({
      slug: slug(),
      title: text({ label: 'Title' }),
      content: textarea({ label: 'Content' }),
      cover: optional(image({ label: 'Cover Image' })),
      published: boolean({ label: 'Published' }),
    }),
  ),
  authors: schema(
    object({
      slug: slug(),
      name: text({ label: 'Name' }),
      avatar: optional(image({ label: 'Avatar' })),
    }),
  ),
})
```

### 2. Add the CMS to your app

```tsx
// index.tsx
import { CMS, createGithubAuth, createGithubBackend } from '@plasticine/core'
import '@plasticine/core/styles.css'
import { Route, Router } from '@solidjs/router'
import config from '../plasticine.config'

const backend = createGithubBackend({
  owner: 'your-username',
  repo: 'your-repo',
  branch: 'main',
  contentPath: 'content',
})

const auth = createGithubAuth()

render(
  () => (
    <Router>
      <Route path="/*" component={App} />
      <Route
        path="/admin/*"
        component={() => <CMS config={config} backend={backend} auth={auth} />}
      />
    </Router>
  ),
  document.getElementById('root')!,
)
```

### 3. Fetch content in your frontend

```ts
import { createGitHubClient, Infer } from '@plasticine/core'
import config from '../plasticine.config'

const content = createGitHubClient(config, {
  owner: 'your-username',
  repo: 'your-repo',
})

// Fully typed!
const posts = await content.posts.getAll()
const post = await content.posts.get('hello-world')

// Type helper for components
type Post = Infer<typeof config, 'posts'>
```

## Architecture

```
@plasticine/core
├── config/      # Schema definition & versioning
├── auth/        # Authentication providers
├── backend/     # Storage backends (GitHub, etc.)
├── client/      # Frontend content fetching
└── ui/          # CMS admin interface
```

### Auth Providers

Each auth provider handles login UI and token persistence:

```ts
import { createGithubAuth } from '@plasticine/core'

const auth = createGithubAuth()
// Provides: checkAuth(), logout(), LoginScreen component
```

### Backends

Backends handle CRUD operations for content, media, and config:

```ts
import { createGithubBackend } from '@plasticine/core'

const backend = createGithubBackend({
  owner: 'user',
  repo: 'repo',
  branch: 'main',
  contentPath: 'content',
})
```

## Field Types

```ts
import {
  text,
  textarea,
  number,
  boolean,
  slug,
  image,
  date,
  markdown,
  select,
  reference,
} from '@plasticine/core'

text({ label: 'Title' })
textarea({ label: 'Description' })
number({ label: 'Count' })
boolean({ label: 'Published' })
slug() // Auto-validates slug format
image({ label: 'Cover', path: 'covers' })
date({ label: 'Published Date' })
markdown({ label: 'Content' })
select(['draft', 'published', 'archived'] as const, { label: 'Status' })
reference('authors', { label: 'Author' }) // Reference another collection
```

## Schema Versioning

Schemas support versioning with automatic migrations using chained `.version()` calls:

```ts
import { defineConfig, schema, text, slug, boolean } from '@plasticine/core'
import { object } from 'valibot'

export default defineConfig({
  posts: schema(
    // v0: Initial schema
    object({
      slug: slug(),
      title: text({ label: 'Title' }),
    }),
  ).version(
    // v1: Add published field
    object({
      slug: slug(),
      title: text({ label: 'Title' }),
      published: boolean({ label: 'Published' }),
    }),
    // Migration from v0 -> v1
    old => ({ ...old, published: false }),
  ),
})
```

When content is loaded, it automatically migrates through each version to reach the current schema.

## CLI

```bash
# Dry-run migrations
pnpm plasticine migrate --dry-run

# Apply migrations
pnpm plasticine migrate

# Custom config path (uses ./plasticine.config.ts by default)
pnpm plasticine migrate -c ./src/config.ts
```

## License

MIT
