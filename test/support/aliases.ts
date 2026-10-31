// Module aliases the test configs share. Paths start from the repo root
// (vitest's root, the working directory): import.meta.url is not a file URL
// under a DOM test environment.
import { resolve } from "node:path";

/**
 * The shipped Svelte and Astro sources import the core as ../dist/index.js;
 * tests point that at the TypeScript source, so they need no build.
 */
export const distToSource = {
  find: /^\.\.\/dist\/index\.js$/,
  replacement: resolve("src/index.ts"),
};
