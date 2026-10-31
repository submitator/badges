# Canonical customer snippets for @submitator/badges

These texts are the canon. The package README prints them verbatim. The app's Configure Badges page prints them
with `YOUR_PROJECT_ID` replaced by the project's public id (and, only when the app's badge host is not
`https://api.submitator.com`, the "Local backend" props added). The landing's /badge-package page prints them
verbatim with the `YOUR_PROJECT_ID` placeholder. FE and LD tests compare their texts with a copy of this file.

Placement line (same words everywhere): "Put the badges on your homepage, usually in its footer: that is the page
directories check."

## Install

```sh
npm i @submitator/badges
```

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
