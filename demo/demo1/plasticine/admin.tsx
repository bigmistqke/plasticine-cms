import { render } from "solid-js/web";
import { CMS, github } from "@plasticine/core";
import "@plasticine/core/styles.css";
import config from "./config";

const backend = github({
  owner: import.meta.env.VITE_GITHUB_OWNER || "bigmistqke",
  repo: import.meta.env.VITE_GITHUB_REPO || "plasticine-cms",
  branch: import.meta.env.VITE_GITHUB_BRANCH || "main",
  contentPath: import.meta.env.VITE_GITHUB_CONTENT_PATH || "demo/demo1/content",
});

render(
  () => (
    <CMS
      config={config}
      backend={backend}
      schemaPath={import.meta.env.VITE_SCHEMA_PATH || "demo/demo1/plasticine/config.ts"}
    />
  ),
  document.getElementById("root")!
);
