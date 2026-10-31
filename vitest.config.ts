import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** React 18.3 lives in an npm workspace (test/floors/react18); see its package.json. */
const react18 = (path: string) =>
  fileURLToPath(new URL(`./test/floors/react18/node_modules/${path}`, import.meta.url));

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
      {
        test: {
          name: "react",
          include: ["test/render/react.test.ts"],
          environment: "node",
          provide: { reactMajor: 19 },
        },
      },
      {
        resolve: {
          alias: [
            { find: /^react$/, replacement: react18("react/index.js") },
            { find: /^react-dom\/server$/, replacement: react18("react-dom/server.node.js") },
          ],
        },
        test: {
          name: "react18",
          include: ["test/render/react.test.ts"],
          environment: "node",
          provide: { reactMajor: 18 },
        },
      },
    ],
  },
});
