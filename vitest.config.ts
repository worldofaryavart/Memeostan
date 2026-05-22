import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Tests run in Node. The db module has no `window` there, so it keeps nation
// state in an in-memory cache — letting us exercise the ledger/economy logic
// directly without a browser or localStorage.
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
