import * as v from "valibot";
import {
  boolean,
  date,
  image,
  markdown,
  optional,
  reference,
  schema,
  select,
  slug,
  text,
  textarea,
  type CMSConfig
} from "./plasticine";

/**
 * Authors collection
 */
export const authors = schema(
  v.object({
    slug: slug({ label: "Slug" }),
    name: text({ label: "Name", placeholder: "John Doe" }),
    bio: optional(textarea({ label: "Bio", placeholder: "A short bio..." })),
    avatar: optional(image({ label: "Avatar" })),
  })
);

/**
 * Posts collection with versioning
 *
 * Version 1: Basic post with title, slug, content
 * Version 2: Added author reference and draft status
 */
export const posts = schema(
  v.object({
    slug: slug({ label: "Slug" }),
    title: text({ label: "Title", placeholder: "My awesome post" }),
    content: markdown({ label: "Content" }),
  })
).version(
  v.object({
    slug: slug({ label: "Slug" }),
    title: text({ label: "Title", placeholder: "My awesome post" }),
    cover: optional(image({ label: "Cover Image" })),
    content: markdown({ label: "Content" }),
    author: optional(reference("authors", { label: "Author" })),
    draft: boolean({ label: "Draft", description: "Keep this post as draft" }),
    publishedAt: optional(date({ label: "Published Date" })),
  }),
  (old) => ({
    slug: old.slug,
    title: old.title,
    cover: undefined,
    content: old.content,
    author: undefined,
    draft: true,
    publishedAt: undefined,
  })
);

/**
 * Pages collection
 */
export const pages = schema(
  v.object({
    slug: slug({ label: "Slug" }),
    title: text({ label: "Title" }),
    content: markdown({ label: "Content" }),
    template: select(["default", "landing", "contact"] as const, {
      label: "Template",
    }),
  })
);

/**
 * CMS Configuration
 *
 * To use this CMS:
 * 1. Create a Personal Access Token at https://github.com/settings/tokens/new?scopes=repo
 * 2. Configure your repo details below
 * 3. Paste your token when prompted in the UI
 */
export const cmsConfig: CMSConfig = {
  github: {
    owner: "bigmistqke", // Replace with repo owner
    repo: "plasticine-cms", // Replace with repo name
    branch: "main",
    contentPath: "content",
  },
  collections: {
    authors: {
      name: "Authors",
      schema: authors,
      filenameField: "slug",
    },
    posts: {
      name: "Posts",
      schema: posts,
      filenameField: "slug",
    },
    pages: {
      name: "Pages",
      schema: pages,
      filenameField: "slug",
    },
  },
};
