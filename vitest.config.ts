import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "core",
          include: ["test/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        test: {
          name: "repo",
          include: ["test/repo/**/*.test.ts"],
          environment: "node",
        },
      },
    ],
  },
});
