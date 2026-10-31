// Module resolution settings the test configs share. Paths start from the
// repo root (vitest's root, the working directory): import.meta.url is not a
// file URL under a DOM test environment.
import { resolve } from "node:path";
import type { Plugin } from "vite";

/**
 * The shipped Svelte and Astro sources import the core as ../dist/index.js;
 * tests point that at the TypeScript source, so they need no build.
 */
export const distToSource = {
  find: /^\.\.\/dist\/index\.js$/,
  replacement: resolve("src/index.ts"),
};

/**
 * Keeps the svelte package out of Vite's dependency pre-bundling. Goes before
 * the Svelte plugin.
 *
 * The Svelte plugin asks every Vite environment (Vitest's own one included)
 * to pre-bundle the bare id svelte. Vite resolves that id from the repo root
 * first, finds this repo's svelte/ folder and bundles our components in place
 * of the package: without dist/ that stops the whole run on their
 * ../dist/index.js import. No test needs pre-bundling.
 */
export function noSveltePrebundle(): Plugin {
  const config = () => ({ optimizeDeps: { exclude: ["svelte"] } });
  return {
    name: "submitator:no-svelte-prebundle",
    enforce: "pre",
    config: { order: "pre", handler: config },
    configEnvironment: { order: "pre", handler: config },
  };
}
