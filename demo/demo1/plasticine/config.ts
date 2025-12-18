import * as v from "valibot";
import { defineConfig } from "@plasticine/core/schema";
import {
  boolean,
  date,
  image,
  markdown,
  optional,
  reference,
  select,
  slug,
  text,
  textarea,
} from "@plasticine/core/fields";

/**
 * Plasticine CMS Configuration
 *
 * Single versioned config containing all schemas and settings.
 * GitHub/runtime config comes from environment variables.
 */
export default defineConfig({
  schemas: {
    authors: v.object({
      slug: slug({ label: "Slug" }),
      name: text({ label: "Name", placeholder: "John Doe" }),
      bio: optional(textarea({ label: "Bio", placeholder: "A short bio..." })),
      avatar: optional(image({ label: "Avatar", path: "avatars" })),
    }),
    posts: v.object({
      slug: slug({ label: "Slug" }),
      title: text({ label: "Title", placeholder: "My awesome post" }),
      content: markdown({ label: "Content" }),
    }),
    pages: v.object({
      slug: slug({ label: "Slug" }),
      title: text({ label: "Title" }),
      content: markdown({ label: "Content" }),
      template: select(["default", "landing", "contact"] as const, {
        label: "Template",
      }),
    }),
  },
}).version({
  schemas: {
    authors: v.object({
      slug: slug({ label: "Slug" }),
      name: text({ label: "Name", placeholder: "John Doe" }),
      bio: optional(textarea({ label: "Bio", placeholder: "A short bio..." })),
      avatar: optional(image({ label: "Avatar", path: "avatars" })),
    }),
    posts: v.object({
      slug: slug({ label: "Slug" }),
      title: text({ label: "Title", placeholder: "My awesome post" }),
      cover: optional(image({ label: "Cover Image", path: "covers" })),
      content: markdown({ label: "Content" }),
      author: optional(reference("authors", { label: "Author" })),
      draft: boolean({ label: "Draft", description: "Keep this post as draft" }),
      publishedAt: optional(date({ label: "Published Date" })),
    }),
    pages: v.object({
      slug: slug({ label: "Slug" }),
      title: text({ label: "Title" }),
      content: markdown({ label: "Content" }),
      template: select(["default", "landing", "contact"] as const, {
        label: "Template",
      }),
    }),
  },
}, (old) => ({
  schemas: {
    authors: old.schemas.authors,
    posts: {
      ...old.schemas.posts,
      cover: undefined,
      author: undefined,
      draft: true,
      publishedAt: undefined,
    },
    pages: old.schemas.pages,
  },
}));
