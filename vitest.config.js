import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",

    include: ["test/**/*.test.js", "test/**/*.it.js"],

    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.{idea,git,cache,output,temp}/**",
    ],

    testTimeout: process.env.INTEGRATION_TEST ? 60000 : 10000,
    hookTimeout: process.env.INTEGRATION_TEST ? 60000 : 10000,
    fileParallelism: !process.env.INTEGRATION_TEST,

    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "@test": new URL("./test", import.meta.url).pathname,
    },

    setupFiles: process.env.INTEGRATION_TEST
      ? ["./test/integration/setup.js"]
      : undefined,

    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],

      exclude: [
        "**/__mocks__/**",
        "**/*.mock.{js,ts}",
        "**/*.spec.{js,ts}",
        "**/*.test.{js,ts}",
        "**/*.it.{js,ts}",
        "**/coverage/**",
        "**/dist/**",
        "**/node_modules/**",
        "**/*.config.js",
        "**/*.d.ts",
        "**/test/**",
      ],

      cleanOnRerun: true,
      reportsDirectory: "./coverage",

      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
      //enabled: !process.env.INTEGRATION_TEST,
    },
  },
});
