import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

export default defineConfig({
  root: path.dirname(fileURLToPath(import.meta.url)),
  test: {
    environment: "node",
    include: ["test/**/*.test.js"],
  },
});
