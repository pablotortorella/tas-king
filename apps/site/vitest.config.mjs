import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const siteDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: path.resolve(siteDir, "../.."),
  test: {
    environment: "node",
    include: ["apps/site/test/**/*.test.js"],
  },
});
