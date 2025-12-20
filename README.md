# Plasticine

A git-based headless CMS for SolidJS with type-safe content management.

## Features

- **Git-based storage** - Content stored as JSON files in your repository
- **Type-safe schemas** - Define content types with Valibot schemas
- **Schema versioning** - Automatic migrations when schemas change
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
// config.ts
import { defineConfig, fields } from '@plasticine/core'
import * as v from 'valibot'

export default defineConfig({
  collections: {
    posts: v.object({
      slug: fields.slug(),
      title: fields.text({ label: 'Title' }),
      content: fields.textarea({ label: 'Content' }),
      cover: fields.image({ label: 'Cover Image' }),
      published: fields.boolean({ label: 'Published' }),
    }),
    authors: v.object({
      slug: fields.slug(),
      name: fields.text({ label: 'Name' }),
      avatar: fields.image({ label: 'Avatar' }),
    }),
  },
})
```

### 2. Add the CMS to your app

```tsx
// index.tsx
import { CMS, createGithubAuth, createGithubBackend } from '@plasticine/core'
import '@plasticine/core/styles.css'
import { Route, Router } from '@solidjs/router'
import config from './config'

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
        component={() => (
          <CMS
            config={config}
            backend={backend}
            auth={auth}
            schemaPath="config.ts"
          />
        )}
      />
    </Router>
  ),
  document.getElementById('root')!,
)
```

### 3. Fetch content in your frontend

```ts
import { createGitHubClient, Infer } from '@plasticine/core'
import config from './config'

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
import { fields } from '@plasticine/core'

fields.text({ label: 'Title' })
fields.textarea({ label: 'Description' })
fields.number({ label: 'Count' })
fields.boolean({ label: 'Published' })
fields.slug()  // Auto-validates slug format
fields.image({ label: 'Cover' })
fields.file({ label: 'Attachment' })
```

## Schema Versioning

Schemas support versioning with automatic migrations:

```ts
import { defineConfig, versioned } from '@plasticine/core'

export default defineConfig({
  collections: {
    posts: versioned(
      // Previous versions
      [
        v.object({ title: v.string() }), // v0
        v.object({ title: v.string(), slug: v.string() }), // v1
      ],
      // Current schema
      v.object({
        title: v.string(),
        slug: v.string(),
        published: v.boolean(),
      }),
      // Migrations
      [
        (data) => ({ ...data, slug: slugify(data.title) }), // v0 -> v1
        (data) => ({ ...data, published: false }), // v1 -> v2
      ]
    ),
  },
})
```

## CLI

```bash
# Dry-run migrations
pnpm plasticine migrate --dry-run

# Apply migrations
pnpm plasticine migrate
```

## License

MIT
