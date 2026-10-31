// The example apps and what run-example.mjs checks in each. Every app is a
// folder of examples/ with `build` and `start` scripts; `start` serves on
// 127.0.0.1 at $PORT. Every app talks to the mock wall server at
// http://127.0.0.1:4010 with the test key, like the README's "Local backend".
//
// framework: the User-Agent token the app's wall requests must carry.
// negative:  a client-only render; the self-check must find 0.
// broken:    a page rendering the bad-signature project: 200 and no wall.
// pages:     more pages that must pass the self-check.
// lifetime:  pages whose Cache-Control must say this (Next.js ISR, pitfall 2).
// bump:      seconds to wait for a badge added on the server to show up.
// latest:    packages the weekly job moves to @latest.

export const APPS = {
  "next-app": {
    framework: "next",
    broken: "/broken",
    pages: ["/about"],
    lifetime: { "/": "s-maxage=15", "/about": "s-maxage=15" },
    bump: 120,
    latest: ["next", "react", "react-dom"],
  },
  "next-cache-components": {
    framework: "next",
    broken: "/broken",
    pages: ["/suspense"],
    latest: ["next", "react", "react-dom"],
  },
  "next-pages": {
    framework: "next",
    broken: "/broken",
    latest: ["next", "react", "react-dom"],
  },
  nuxt: {
    framework: "nuxt",
    broken: "/broken",
    bump: 150,
    latest: ["nuxt", "vue"],
  },
  sveltekit: {
    framework: "sveltekit",
    broken: "/broken",
    latest: [
      "@sveltejs/kit",
      "@sveltejs/adapter-node",
      "@sveltejs/vite-plugin-svelte",
      "svelte",
      "vite",
    ],
  },
  "astro-ssr": {
    framework: "astro",
    broken: "/broken",
    latest: ["astro", "@astrojs/node"],
  },
  "astro-static": {
    framework: "astro",
    broken: "/broken",
    latest: ["astro"],
  },
  "node-http": {
    framework: "node",
    broken: "/broken",
    latest: [],
  },
  "next-client-only": {
    framework: "next",
    negative: true,
    latest: ["next", "react", "react-dom"],
  },
  "nuxt-client-only": {
    framework: "nuxt",
    negative: true,
    latest: ["nuxt", "vue"],
  },
};
