import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    root: __dirname,
    environment: "node",
    globals: true,
    include: ["test/tests/**/*{test,spec}.{ts,tsx}"],
    fileParallelism: false,
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
