# @submitator/badges

Your Submitator badges, fetched by your server and written into the HTML it sends: the HTML
directories read when they check that their badge is on your site. One component for Next.js,
Nuxt, SvelteKit and Astro, or one function for any other Node.js server.

Put the badges on your homepage, usually in its footer: that is the page directories check.

## How it works

- Your server asks `api.submitator.com` for your project's badge wall: the badges you installed in
  Submitator (ours, the directories', your own) as data, never as HTML.
- The wall is signed. The package checks its Ed25519 signature against two public keys pinned in
  its code, then checks every badge against the [wall contract](CONTRACT.md): known tags,
  attributes, URLs and styles only. A badge that fails is left out, the others show.
- Your framework writes the badges as plain elements, with its own escaping: no HTML strings, no
  `dangerouslySetInnerHTML`, `v-html`, `{@html}` or `set:html`. One `<style>` element comes with
  them. The strip scrolls with CSS only, pauses on hover and keyboard focus, and stands still for
  visitors who ask for reduced motion.
- Your visitors' browsers never contact our API. With Next.js Server Components (App Router) and
  Astro the badges ship no JavaScript at all; in Nuxt, SvelteKit and the Pages Router the
  component hydrates with the rest of your page.
- It never breaks your page: with no wall to show it renders nothing, and it keeps the last good
  wall through our outages until it expires, 7 days after we signed it.
- No runtime dependencies. MIT license.

## Install

```sh
npm i @submitator/badges
```

`YOUR_PROJECT_ID` below is your project's public ID, a UUID. The Configure Badges page of the
Submitator app shows these snippets with it filled in.

## Next.js (App Router)

```tsx
// app/page.tsx: your homepage, a Server Component (no "use client")
import { SubmitatorBadges } from "@submitator/badges/react";

export default function Home() {
  return (
    <footer>
      <SubmitatorBadges project="YOUR_PROJECT_ID" />
    </footer>
  );
}
```

`SubmitatorBadges` is an async Server Component. A page that shows it is revalidated at least
every 60 seconds, also when the wall came from the package's memory.

## Next.js 16 with cacheComponents

```tsx
// app/badges.tsx: render <Badges /> in your homepage footer
import { cacheLife } from "next/cache";
import { SubmitatorBadges } from "@submitator/badges/react";

export async function Badges() {
  "use cache";
  cacheLife("minutes");
  return <SubmitatorBadges project="YOUR_PROJECT_ID" />;
}
```

`minutes` keeps the wall in the prerendered page and refreshes it in the background every minute.
The other way is `<Suspense fallback={null}>` around `<SubmitatorBadges />`: the wall then renders
on every request and streams into the HTML.

## Next.js (Pages Router)

```tsx
// pages/index.tsx
import { fetchWall, type Wall } from "@submitator/badges";
import { BadgeWall } from "@submitator/badges/react";

export async function getStaticProps() {
  return { props: { wall: await fetchWall({ project: "YOUR_PROJECT_ID" }) }, revalidate: 60 };
}

export default function Home({ wall }: { wall: Wall | null }) {
  return (
    <footer>
      <BadgeWall wall={wall} />
    </footer>
  );
}
```

## Nuxt

```ts
// server/api/submitator-badges.get.ts
import { fetchWall } from "@submitator/badges";

export default defineEventHandler(async () => ({
  wall: await fetchWall({ project: "YOUR_PROJECT_ID", framework: "nuxt" }),
}));
```

```vue
<!-- components/SubmitatorBadges.vue: render it in your homepage footer -->
<script setup lang="ts">
import { BadgeWall } from "@submitator/badges/vue";

const { data } = await useFetch("/api/submitator-badges");
</script>

<template>
  <BadgeWall v-if="data?.wall" :wall="data.wall" />
</template>
```

The route returns `{ wall }`, never a bare `null` (h3 would answer 204 with no body). `useFetch`
calls it on the server while the page renders, so the badges are in the HTML, and the browser
does not fetch them again.

## SvelteKit

```ts
// src/routes/+layout.server.ts (merge into your load if you have one)
import { fetchWall } from "@submitator/badges";

export async function load() {
  return { wall: await fetchWall({ project: "YOUR_PROJECT_ID", framework: "sveltekit" }) };
}
```

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { BadgeWall } from "@submitator/badges/svelte";

  let { data, children } = $props();
</script>

{@render children()}

<footer>
  {#if data.wall}
    <BadgeWall wall={data.wall} />
  {/if}
</footer>
```

## Astro

```astro
---
// src/components/Footer.astro
import { SubmitatorBadges } from "@submitator/badges/astro";
---

<footer>
  <SubmitatorBadges project="YOUR_PROJECT_ID" />
</footer>
```

Note: Astro prerenders pages by default, so the badges change only when you rebuild. For live badges add
`export const prerender = false` to `src/pages/index.astro` (needs a server adapter). Never wrap the badges in a
server island (`server:defer`): it loads by script, and directories never see it.

## Any other Node server

```js
import { fetchWall, wallToHtml } from "@submitator/badges";

const wall = await fetchWall({ project: "YOUR_PROJECT_ID" });
const badgesHtml = wallToHtml(wall); // "" when there is no wall; every value is escaped
// Print badgesHtml inside your footer, in the HTML your server sends.
```

Bun, Deno and Cloudflare Workers run it too.

## Still row instead of the scrolling strip

Add `layout="row"` to the component (or pass `{ layout: "row" }` to `wallToHtml`).

## Local backend (development only)

```tsx
<SubmitatorBadges
  project="YOUR_PROJECT_ID"
  apiUrl="http://localhost:3001"
  publicKeys={{ "test-rfc8032-1": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo" }}
/>
```

The same two options exist on `fetchWall`. The package refuses `publicKeys` while `apiUrl` is the default.

## Check your install

```sh
curl -sL 'https://your-site.com' | grep -cE 'data-sbm-ref="?YOUR_PROJECT_ID'
```

1 or more means your badges are in the HTML your server sends, which is what directories read. 0 means they
are not, however right the page looks in a browser.

The check looks for `data-sbm-ref`, the marker on our own badge's link. `ref=YOUR_PROJECT_ID` alone
is not enough: it also matches the page data of a site that renders the badges only in the
browser.

## Options

| Option                                                          | On                              | Default                      | What it does                                                                                                             |
| --------------------------------------------------------------- | ------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `project`                                                       | `fetchWall`, `SubmitatorBadges` | required                     | Your project's public ID (a UUID).                                                                                       |
| `apiUrl`                                                        | `fetchWall`, `SubmitatorBadges` | `https://api.submitator.com` | Where walls come from: `https://`, or `http://` on `localhost`, `127.0.0.1` or `[::1]`.                                  |
| `revalidate`                                                    | `fetchWall`, `SubmitatorBadges` | `60`                         | Seconds between background refreshes of the wall in memory, 15 to 60.                                                    |
| `timeout`                                                       | `fetchWall`, `SubmitatorBadges` | `2000`                       | Milliseconds a render waits for a wall, only while none is in memory, 100 to 10000.                                      |
| `framework`                                                     | `fetchWall`, `SubmitatorBadges` | the adapter or the runtime   | Your framework's name in the request: `next`, `nuxt`, `sveltekit`, `astro`, `react`, `vue`, `svelte`, `node`, and so on. |
| `publicKeys`                                                    | `fetchWall`, `SubmitatorBadges` | the pinned production keys   | `{ keyId: publicKey }` of a local or test backend. Refused while `apiUrl` is the default.                                |
| `log`                                                           | `fetchWall`, `SubmitatorBadges` | `console.warn`               | Where warnings go, one per problem until it clears. `false` silences them.                                               |
| `wall`                                                          | `BadgeWall`, `wallToHtml`       | required                     | The wall from `fetchWall`. `null` or `undefined` renders nothing.                                                        |
| `layout`                                                        | every renderer                  | `"marquee"`                  | `marquee` scrolls (from 3 badges up; fewer stand still), `row` stands still and wraps.                                   |
| `className` (React, `wallToHtml`), `class` (Vue, Svelte, Astro) | every renderer                  | none                         | Extra classes on the wall's root element.                                                                                |
| `nonce`                                                         | every renderer                  | none                         | A CSP nonce for the wall's `<style>` element.                                                                            |

Entry points: `@submitator/badges` (`fetchWall`, `wallToHtml`, `parseWall`, `verifyEnvelope`,
`layoutWall`, `styleText`, `CSS`, `DEFAULTS`, `LIMITS`, `PUBLIC_KEYS`, `VERSION`, `WALL_VERSION`,
`DEFAULT_API_URL` and the types), `@submitator/badges/react` (`SubmitatorBadges`, `BadgeWall`),
`@submitator/badges/vue` (`BadgeWall`), `@submitator/badges/svelte` (`BadgeWall`, Svelte 5
source) and `@submitator/badges/astro` (`SubmitatorBadges`, `BadgeWall`, Astro source). Named
exports only.

## Freshness and caches

- **Memory.** Each server process keeps the wall of every project it renders. A render gets the
  wall in memory at once; when that copy is older than `revalidate` (60 seconds), the render still
  gets it, and one refresh starts in the background. A render waits, up to `timeout` (2 seconds),
  only when nothing is in memory yet, like the first render after a deploy.
- **Failures.** After a failed refresh the package waits 30 seconds, or what our server's
  `Retry-After` asks (30 seconds to 10 minutes). Through outages, errors and bad answers it keeps
  the last good wall until that wall expires, 7 days after we signed it.
- **How fast new badges appear.** On a site with visitors, usually within two minutes: up to a
  minute in the package's memory, plus up to a minute in your framework's page cache.
- **Next.js.** Every page that renders the wall gets a lifetime of at most `revalidate` seconds,
  also when the wall came from memory: the package makes a `data:` request that Next.js caches
  like any fetch, and that never leaves your server. A wall in a layout shared by every page
  makes every page regenerate each minute, one more reason to keep it on the homepage.
- **CDNs and proxies.** Cache your homepage for 60 seconds or less (`s-maxage=60` or lower), or
  the badges lag behind by the cache's lifetime. The wall request itself is never cached by a
  browser: it comes from your server.
- **Static builds.** With Next.js `output: "export"`, SvelteKit `prerender = true`, Astro's
  default static output or any prebuilt HTML, the badges are fetched at build time and change
  only when you rebuild. Rebuild on a schedule, or render the homepage on demand.
- **Client-only rendering does not count.** A `"use client"` component that fills the badges in
  `useEffect`, Nuxt's `<ClientOnly>`, Svelte's `{#if browser}`, Astro's `client:only` or a server
  island all look right in a browser, but the HTML your server sends has no badge. The check
  above finds 0 on such pages.

## Content Security Policy

- `style-src`: badges carry inline `style` attributes. Allow them with `'unsafe-inline'`, or keep
  `style-src` strict and add `style-src-attr 'unsafe-inline'`, then give the wall's `<style>`
  element your nonce with the `nonce` option.
- `img-src`: `https:`, plus `http:` if one of your directories serves its badge image over http.
- `script-src` and `connect-src` need nothing: the package runs no script in the browser for the
  badges and never calls our API from there.

## What the package sends

- One request, from your server: `GET https://api.submitator.com/badge/<project id>/wall/v1` with
  `Accept: application/json` and
  `User-Agent: submitator-badges/<version> (<framework>[; dev]; +https://submitator.com/badge-package)`.
- So it tells us your project ID, the package version and your framework's name. `dev` marks a
  development server, which we never count as an install.
- No cookies, no body, no query string, no other header. No telemetry.
- It reads no secrets and no configuration: it only checks `NODE_ENV` and `NEXT_RUNTIME`, to label
  its request.
- We keep the time of the last request, the package version and the framework's name, to show
  your install on the Configure Badges page, and log your server's IP at most once an hour.
- In a browser, `fetchWall` returns `null` and sends nothing.

## Runtimes

| Runtime                        | Status                                                                     |
| ------------------------------ | -------------------------------------------------------------------------- |
| Node.js 20.9 or later          | Supported; CI runs Node.js 20, 22 and 24.                                  |
| Bun                            | Supported; CI runs the latest Bun.                                         |
| Deno 2                         | Supported; CI runs the latest Deno 2.                                      |
| Cloudflare Workers (workerd)   | Supported; CI runs workerd through Miniflare.                              |
| Vercel Edge and other runtimes | Not tested. Any runtime with `fetch` and Ed25519 in WebCrypto should work. |
| Browsers                       | `fetchWall` returns `null`: render the badges on your server.              |

Where a runtime cannot check Ed25519 signatures, the package shows no badges and logs one warning.
There is no unverified mode.

Frameworks tested in CI with real apps: Next.js 16 (App Router, Cache Components, Pages Router),
Nuxt 4, SvelteKit 3, Astro 7, and a plain Node.js server. The render tests also cover React 18.3
and 19, Vue 3.4 and 3.5 and Svelte 5. The peer ranges: `react` 18.3 or later, `vue` 3.4 or later,
`svelte` 5 or later, `astro` 4 or later, each optional.

## Troubleshooting

- **The check finds 0, but the badges show in your browser.** They are rendered in the browser
  only. Render them on the server, as in the snippets above.
- **Next.js with `cacheComponents` stops the build** with "Next.js encountered uncached or runtime
  data during prerendering" (`blocking-prerender-dynamic`). Put `SubmitatorBadges` inside a
  `"use cache"` component, as in the snippet, or inside `<Suspense>`.
- **The badges never change** on a prerendered or static page: see Static builds above.
- **The log says the wall is signed with a key this package does not know.** Update
  `@submitator/badges`: we rotated a key. With a local backend, pass its `publicKeys`.
- **The log says this runtime cannot check Ed25519 signatures.** Render the badges in Node.js 20.9
  or later, Bun, Deno or Cloudflare Workers.

Every log line starts with `[@submitator/badges]`. `log: false` silences them.

## Security and keys

- Walls are signed with Ed25519 over the exact bytes we send. The package pins two production
  public keys: `k202611-a` signs every wall, and `k202611-b` is a backup kept offline. If the first
  ever leaks, our server switches to the backup, and every version of the package accepts it
  without an update.
- The test key `test-rfc8032-1` (RFC 8032 section 7.1, TEST 1) is public on purpose. The package
  accepts it only through `publicKeys`, which it refuses while `apiUrl` is the default.
- A host without our key cannot forge a wall. A badge that fails the checks is left out. The
  wall's root uses `contain: paint`, so no badge can draw outside the strip.
- [SECURITY.md](SECURITY.md) lists the keys and how to report a vulnerability:
  vlad@submitator.com.

## Versioning

- [Semantic Versioning](https://semver.org/). Patch: fixes. Minor: new options or layouts, a
  pinned key added or removed, or a move to a new wall contract that our server serves next to the
  old one. Major: a breaking change of the API, a higher Node.js floor or a dropped framework
  major.
- The wall contract ([CONTRACT.md](CONTRACT.md)) is frozen at version 1. A change of shape ships
  as `/wall/v2`, served next to v1 for at least 12 months.
- [CHANGELOG.md](CHANGELOG.md) lists every release.

## Development

```sh
npm ci
npm run typecheck && npm test
npm run lint:package && npm pack && npm run pack:check
npm run test:smoke
node examples/run-example.mjs next-app
```

`examples/` holds real apps for every framework, built and checked in CI against a mock wall
server; [examples/README.md](examples/README.md) says what each one checks.
[RELEASING.md](RELEASING.md) is the release runbook.

## License

MIT, Copyright (c) 2026 Adeptus Innovatio SL. See [LICENSE](LICENSE).

## Contact

vlad@submitator.com
