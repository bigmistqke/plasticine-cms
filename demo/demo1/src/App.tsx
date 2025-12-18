import { CMS } from "@plasticine/core";
import "@plasticine/core/styles.css";
import { cmsConfig } from "../plasticine.config";

export default function App() {
  return <CMS config={cmsConfig} />;
}
