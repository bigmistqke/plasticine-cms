import { boolean, date, image, markdown, reference, select, slug, text, textarea, } from "@plasticine/core/fields";
import { defineConfig, schema } from "@plasticine/core/schema";
import { array, object, optional } from "valibot";

export default defineConfig({
  authors: schema(
    object({
      slug: slug({ label: "Slug" }),
      name: text({ label: "Name", placeholder: "John Doe" }),
      bio: optional(textarea({ label: "Bio", placeholder: "A short bio..." })),
      avatar: optional(image({ label: "Avatar", path: "avatars" })),
    })
  ),
  posts: schema(
    object({
      slug: slug({ label: "Slug" }),
      title: text({ label: "Title", placeholder: "My awesome post" }),
      content: markdown({ label: "Content" }),
    })
  ).version(
    object({
      slug: slug({ label: "Slug" }),
      title: text({ label: "Title", placeholder: "My awesome post" }),
      cover: optional(image({ label: "Cover Image", path: "covers" })),
      content: markdown({ label: "Content" }),
      author: optional(reference("authors", { label: "Author" })),
      draft: boolean({ label: "Draft", description: "Keep this post as draft" }),
      publishedAt: optional(date({ label: "Published Date" })),
      images: array(
        object({
          src: image({ label: "Image", path: "posts" }),
          alt: optional(text({ label: "Alt Text" })),
          tags: array(
            object({
              name: text({ label: "Tag Name" }),
            })
          ),
        })
      ),
    }),
    (old) => ({
      ...old,
      cover: undefined,
      author: undefined,
      draft: true,
      publishedAt: undefined,
      images: [],
    })
  ),
  pages: schema(
    object({
      slug: slug({ label: "Slug" }),
      title: text({ label: "Title" }),
      content: markdown({ label: "Content" }),
      template: select(["default", "landing", "contact"] as const, {
        label: "Template",
      }),
    })
  ),
});

