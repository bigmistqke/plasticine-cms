import { CMS } from "@plasticine/core";
import "@plasticine/core/styles.css";
import config from "../plasticine.config";

// GitHub config - should come from environment variables in production
const github = {
  owner: import.meta.env.VITE_GITHUB_OWNER || "bigmistqke",
  repo: import.meta.env.VITE_GITHUB_REPO || "plasticine-cms",
  branch: import.meta.env.VITE_GITHUB_BRANCH || "main",
  contentPath: import.meta.env.VITE_GITHUB_CONTENT_PATH || "demo/demo1/content",
};

export default function App() {
  return <CMS config={config} github={github} />;
}
