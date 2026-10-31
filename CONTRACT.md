# Badge wall contract, version 1

Status: frozen on 2026-10-31. Any change to the shape below ships as `/wall/v2` with `"v": 2`,
served next to v1 for at least 12 months. Nothing is ever added to v1 in place.

This file is the single source of truth for the server (submitator-backend) and the package
(`@submitator/badges`). Both test suites run the shared fixtures in `test/fixtures/contract-v1/`
of the package repo. Invariant: every badge the server emits passes the package's badge checks.
The server leaves out, and reports, anything that would fail them.

## 1. Request

`GET {apiUrl}/badge/{project}/wall/v1`

- `apiUrl` defaults to `https://api.submitator.com`. Trailing slashes are stripped. It must be
  `https:`, or `http:` only for `localhost`, `127.0.0.1` or `[::1]`. No credentials, query or hash.
- `project` is the project's public id: a UUID, sent lowercase.
- Headers the package sends: `Accept: application/json` and
  `User-Agent: submitator-badges/<version> (<framework>[; dev]; +https://submitator.com/badge-package)`.
  - `<version>` is the package's semver.
  - `<framework>` matches `^[a-z][a-z0-9-]{0,31}$`: one of `next`, `react`, `nuxt`, `vue`, `sveltekit`,
    `svelte`, `astro`, `node`, `bun`, `deno`, `workerd`, `edge`, `other`. It comes from the
    `framework` option, else the adapter, else the detected runtime.
  - `; dev` is appended when `process.env.NODE_ENV === "development"`.
- No cookies, no body, no query string, `redirect: "manual"`.
- The package never fetches from a browser: `fetchWall` returns `null` when `typeof document !== "undefined"`.

## 2. Responses

| Status | When | Body | Headers |
|---|---|---|---|
| 200 | wall served | the envelope (section 3) | `Content-Type: application/json`, `Cache-Control: max-age=60, public, stale-while-revalidate=60`, `X-Robots-Tag: noindex`, `X-Content-Type-Options: nosniff` |
| 404 | unknown project, or refused by host partitioning | none | `X-Robots-Tag: noindex` |
| 503 | `BADGE_WALL=0`, or no valid signing key | none | `Cache-Control: no-store`, `Retry-After: 300` |

- CORS is `*` like the rest of `/badge/*`. No response ever carries `Set-Cookie`.
- `/badge/{project}/wall/v1.json` and any other suffix are 404.
- The existing `/badge/{project}`, `.json` and `.html` feeds never change.

## 3. Envelope

A JSON object with exactly three string keys: `payload`, `signature`, `keyId`.

- `payload`: the wall (section 4) as JSON text. The signature covers its UTF-8 bytes, exactly as sent.
- `signature`: Ed25519 over those bytes, base64url without padding: 86 characters, `^[A-Za-z0-9_-]{86}$`,
  64 bytes decoded.
- `keyId`: `^[a-z0-9][a-z0-9-]{0,31}$`.
- Public keys are base64url without padding of the 32-byte raw Ed25519 key (43 characters).
- Size: `payload` at most 524,288 UTF-8 bytes; the whole response body at most 1,048,576 bytes
  (the package refuses a larger `Content-Length` unread and stops reading past the cap).

Keys:

| keyId | Role |
|---|---|
| `k202611-a` | production primary, signs (seed in Koyeb `BADGE_WALL_SIGNING_KEY`) |
| `k202611-b` | production backup, kept offline by the owner |
| `test-rfc8032-1` | tests and local development only, never accepted in production |

`test-rfc8032-1` is RFC 8032 section 7.1 TEST 1: seed `nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A`,
public key `11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo`. The shared vector is `vector.json`.
The package pins only the two production keys; it accepts other keys only through the `publicKeys`
option, which it refuses while `apiUrl` is the default.

## 4. Wall (payload)

A JSON object with exactly these keys, in this order when the server writes them:
`v`, `project`, `issuedAt`, `expiresAt`, `badges`.

- `v`: `1`.
- `project`: the requested project id, lowercase.
- `issuedAt`, `expiresAt`: UTC, `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$`.
  The server writes whole seconds: `issuedAt` = when the cached body was built (up to about 5 minutes
  before it is served), `expiresAt` = `issuedAt` + 7 days.
  The package requires `issuedAt < expiresAt`, `expiresAt - issuedAt <= 8 days` and `now < expiresAt`.
- `badges`: an array. The server sends at most 150, the package accepts at most 200. The server drops
  trailing badges (reported as `over_limit`, custom badges go first because they come last) so the payload
  never exceeds 524,288 bytes.
  Order: the self badge first, then directory badges in install order, then custom badges in creation order.

## 5. Badge

A JSON object. Keys are a subset of `kind`, `id`, `name`, `host`, `tree`, written in that order.

- `kind`: `self`, `directory` or `custom`.
- `id`: `self`, `d_<directory public uuid>` or `c_<custom badge uuid>`, matching `^(self|[dc]_[0-9a-f-]{36})$`.
- `name`: 1..120 characters, no C0 control character and no DEL. The directory's name, or the customer's
  name for a custom badge. Omitted for `self`.
- `host`: the normalized host of the badge's first `a[href]` (lowercase, no `www.`), 1..253 characters,
  no whitespace, control character, `/`, `?` or `#`. Omitted when there is none.
- `tree`: an array of 1..16 nodes (section 6).

The package wraps every `custom` tree in `<span class="sbm-cb">` (our directory badge check skips anchors
inside `span.sbm-cb`). The server never puts that wrapper in a tree, and no other kind is wrapped in it.

## 6. Node

A node is a text string or an element object.

**Text**: a string of 1..1000 characters. The server collapses every run of `[ \t\n\r\f]` to one space and
drops a whitespace-only text node when it is the first or last node of the tree, or a child of `svg`,
`path` or `circle`. The package accepts any text of 1..1000 characters without C0 controls other than
TAB, LF and CR, and without DEL.

**Element**: an object whose keys are a subset of `t`, `a`, `s`, `c` (the server omits empty `a`, `s`, `c`):

- `t`: `a`, `img`, `span`, `svg`, `path` or `circle`.
- `a`: attributes, an object of string values, in source order. Allowed names, and only these:
  `href src alt title width height loading target rel viewBox fill stroke stroke-width stroke-linecap
  stroke-linejoin d cx cy r xmlns data-sbm-ref data-badge-ref aria-label aria-hidden`.
  There is no `class`, `style`, `id` or event handler: the server drops `class` and every other
  attribute silently, and turns `style` into `s`.
  - Values: empty allowed (`alt=""`), at most 2048 characters (`d` at most 8192), no C0 control other than
    TAB, LF and CR, no DEL.
  - `href` only on `a`, `src` only on `img`. Each must match `^https?://[^\s]` (case-insensitive) as sent,
    with no C0 or DEL anywhere. `http://` is valid (some directories use it). Interior raw spaces are kept:
    values are never URL-normalized. The server trims surrounding ASCII whitespace before the check and
    leaves the badge out when the trimmed value fails.
  - `xmlns` only on `svg`, and only `http://www.w3.org/2000/svg`.
- `s`: inline style, an array of at most 64 `[property, value]` string pairs, in source order,
  duplicates kept.
  - `property`: `^(--[A-Za-z0-9_-]{1,62}|-?[a-z][a-z0-9-]{0,62})$`. `behavior`, `behaviour` and
    `-moz-binding` are refused.
  - `value`: 1..1024 characters, trimmed. Refused when it contains any of `; { } < > \`, a C0 control
    character or DEL, an `!`, a match of `/url\s*\(|expression\s*\(|@import|image-set\s*\(|\/\*|\*\//i`,
    unbalanced `'` or `"`, or parentheses unbalanced outside quotes. A `position` whose value contains
    `fixed` (any case) is refused. The server strips a trailing `!important` before checking.
- `c`: children, an array of nodes.

**Structure**:
- `img`, `path` and `circle` have no children.
- `path` and `circle` appear only as children of `svg`; the children of `svg` are only `path` and `circle`.
- No `a` inside an `a` at any depth, and no `svg` inside an `svg`.

**Limits per badge**: at most 16 root nodes, at most 100 nodes (server) or 300 (package), depth at most 16,
and the server keeps each tree's JSON at most 8192 bytes.

## 7. Failure rules (package)

- **Wall level**, render no new wall and keep the last good one until its `expiresAt`: body over the cap,
  not JSON, envelope shape, unknown `keyId`, bad signature, payload not JSON or shaped wrong, `v` not 1,
  project mismatch, bad or expired timestamps, lifetime over 8 days, more than 200 badges.
- **Badge level**, skip that badge and keep the others in order: any rule of sections 5 and 6 on `kind`,
  `tree`, nodes, attributes, styles, structure or limits.
- **Lenient fields**, drop the field and keep the badge: a malformed `id`, `name` or `host`.

## 8. What the package adds to a tree (and nothing else)

- `loading="lazy"` on an `img` without `loading`.
- `alt` = the badge's `name` on an `img` with no `alt` attribute at all, when a `name` is present.
- `tabindex="-1"` on every `a` inside the loop copy and the fill items, which are `aria-hidden="true"`.
- `<span class="sbm-cb">` around every `custom` tree.

The package never changes `href`, `src`, `rel` or `target`.

## 9. Install detection (server, informative)

A 200 wall response stamps `projects.badge_wall_fetched_at` and `projects.badge_wall_client`
(`"<version> <framework>"`, at most 64 characters) at most once an hour, with `update_all`, never touching
`updated_at`, when all of these hold: the User-Agent matches the grammar of section 1, it carries no `dev`
token, and the request has no `Origin` header. It never writes `badge_feed_fetched_at`, so the badge gate
treats package installs like any server-rendered install.

Server User-Agent pattern:
`\Asubmitator-badges/(?<version>\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z.]{1,20})?)(?: \((?<comment>[^()]{0,200})\))?\z`.
The comment splits on `;`, each token stripped. The first token is the framework when it matches
`\A[a-z][a-z0-9-]{0,31}\z` and is not `dev`, else `unknown`. Any `dev` token means a development client.

Retail diagnostics (`GET /api/v1/projects/:id/badge_diagnostics`) carry
`badge_package: { version, adapter, last_fetched_at, fresh, left_out } | null`, where `left_out` lists
`{ kind, name, reason }` for badges the wall leaves out.

## 10. Self-check

`curl -sL '<site url>' | grep -cE 'data-sbm-ref="?<project id>'`

1 or more means the self badge anchor is in the HTML the server sends. `ref=<id>` is not used: it also
matches the hydration JSON of client-only renders.

## 11. Shared fixtures (`test/fixtures/contract-v1/` in the package repo)

- `vector.json`: the test key, a payload, its signature and envelope, and the RFC 8032 TEST 1
  empty-message signature. Both suites verify it.
- `walls/*.json`: `{ name, now, project, payload, expect: { ok, reason?, ids, skipped } }`. Generated by the
  server's tree builder from golden badge HTML (`bin/rails badge_wall:contract_fixtures`), with a `SOURCE`
  file naming the backend commit. Hand-written rejection cases sit next to them.
- `rendered/*.html`: `wallToHtml` output (marquee and row) for every accepted wall. Generated by the package
  and copied into the backend (`test/fixtures/badge_wall_v1/`), where `BadgeMarker`, `BadgeChecker` and
  `DirectoryBadgeChecker` must find the self badge and every directory host outside `span.sbm-cb`.
