/// <reference types="vitest/config" />
// The Astro render tests run in Astro's own Vite setup, which compiles .astro
// files. vitest.config.ts lists this file as the "astro" project.
import { getViteConfig } from "astro/config";
import { distToSource } from "./test/support/aliases.js";

export default getViteConfig(
  {
    resolve: { alias: [distToSource] },
    test: {
      name: "astro",
      include: ["test/render/astro.test.ts"],
      environment: "node",
    },
  },
  { logLevel: "silent" },
);
