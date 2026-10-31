import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";
import { distToSource } from "./test/support/aliases.js";

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
      {
        test: {
          name: "vue",
          include: ["test/render/vue.test.ts"],
          environment: "happy-dom",
          provide: { vueMinor: "3.5" },
        },
      },
      {
        resolve: {
          alias: [
            { find: /^vue$/, replacement: "vue34" },
            { find: /^vue\/server-renderer$/, replacement: "vue34/server-renderer" },
          ],
        },
        test: {
          name: "vue34",
          include: ["test/render/vue.test.ts"],
          environment: "happy-dom",
          provide: { vueMinor: "3.4" },
        },
      },
      {
        plugins: [svelte({ configFile: false })],
        resolve: { alias: [distToSource] },
        test: {
          name: "svelte",
          include: ["test/render/svelte.server.test.ts"],
          environment: "node",
        },
      },
      {
        plugins: [svelte({ configFile: false })],
        resolve: { alias: [distToSource], conditions: ["browser"] },
        test: {
          name: "svelte-dom",
          include: ["test/render/svelte.dom.test.ts"],
          environment: "happy-dom",
        },
      },
      "./vitest.astro.config.ts",
    ],
  },
});
