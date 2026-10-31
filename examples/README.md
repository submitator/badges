# Examples

Real apps that install the packed package and render a wall from a local mock
server. CI builds and serves every one of them and checks the HTML it sends,
the way directories and our badge checks read it.

| App                     | What it shows                                                                    |
| ----------------------- | -------------------------------------------------------------------------------- |
| `next-app`              | Next.js App Router: `SubmitatorBadges` in a Server Component (ISR, 15 s)         |
| `next-cache-components` | Next.js 16 `cacheComponents`: the wall in `"use cache"`, and inside `<Suspense>` |
| `next-pages`            | Next.js Pages Router: `fetchWall` in `getStaticProps`, `BadgeWall` in the page   |
| `nuxt`                  | Nuxt: a server route plus `useFetch`                                             |
| `sveltekit`             | SvelteKit: the layout's server `load` plus `BadgeWall` in the layout             |
| `astro-ssr`             | Astro with the Node adapter: the homepage renders on demand                      |
| `astro-static`          | Astro static output: badges from build time                                      |
| `node-http`             | A plain Node.js server: `fetchWall` and `wallToHtml`                             |
| `next-client-only`      | Do not copy: a client component fills the wall in `useEffect`                    |
| `nuxt-client-only`      | Do not copy: the wall inside `<ClientOnly>`                                      |

The two client-only apps look right in a browser, yet the server HTML holds no
badge: the self-check must find 0 there. The wall still travels in their page
data with `?ref=<project id>`, which is why the self-check looks for
`data-sbm-ref` and not `ref=`.

## Run one

Node.js 24.15 or later (Nuxt needs it), from the repo root after `npm ci`:

```sh
node examples/run-example.mjs next-app
```

It packs the repo (`npm pack`, which builds it), copies the tarball to
`examples/.pack/submitator-badges.tgz` (every app depends on that file), starts
the mock wall server on 127.0.0.1:4010, installs, builds and starts the app on
127.0.0.1:4100, then checks:

- the self-check of CONTRACT.md section 10 on the homepage (`grep -cE 'data-sbm-ref="?<id>'`);
- one wall root, one `<style>`, no `<script>` inside it, the self badge link with its marker;
- directory links outside `span.sbm-cb`, custom badge links inside it;
- links in the loop copy and fill items with `tabindex="-1"`;
- a page rendering a wall with a bad signature still answers 200 and shows no wall;
- every wall request: the User-Agent of CONTRACT.md section 1 with the app's
  framework, no dev token, no `Origin`, no cookie;
- `next-app`: `s-maxage=15` on two pages, and a badge added on the server shows
  up by itself (also in `nuxt`).

Options: `--tarball <path>` installs a tarball you packed, `--save-page` writes
the homepage to `test/fixtures/contract-v1/pages/<app>.html` (the backend
vendors these pages for its own checks), `--latest` moves the frameworks to
`@latest`, as the weekly CI job does.

## The mock wall server

`mock-wall-server/server.mjs` answers `GET /badge/<project>/wall/v1` like the
real server and signs with the RFC 8032 test key (`test-rfc8032-1`), which the
package accepts only through `publicKeys` with a local `apiUrl`. One project per
behaviour, see `mock-wall-server/projects.mjs`:

| Project                                | Answer                                            |
| -------------------------------------- | ------------------------------------------------- |
| `00000000-0000-4000-8000-000000000001` | a good wall: self, four directories, two custom   |
| `00000000-0000-4000-8000-000000000002` | a good wall with a bad signature                  |
| `00000000-0000-4000-8000-000000000003` | 503 with `Retry-After: 300` (the kill switch)     |
| `00000000-0000-4000-8000-000000000004` | a good wall after 3 seconds                       |
| `00000000-0000-4000-8000-000000000005` | a wall that expired a day ago                     |
| `00000000-0000-4000-8000-000000000006` | a good wall plus one badge the package leaves out |

`POST /__bump?project=<id>` adds a directory badge, `GET /__requests` lists the
wall requests with their headers, `POST /__reset` forgets both.

## Check any site

`check-html.mjs` runs the same checks on a live page:

```sh
node examples/check-html.mjs --url https://your-site.com --project YOUR_PROJECT_ID
```
