# Changelog

All notable changes to `@submitator/badges` are listed here. The package follows
[Semantic Versioning](https://semver.org/).

## Unreleased

The first release, 1.0.0.

- `fetchWall` fetches your project's badge wall on your server, checks its Ed25519 signature
  against the two pinned production keys (`k202611-a`, `k202611-b`) and checks every badge
  against wall contract v1 (CONTRACT.md). A badge that fails is left out; a wall that fails is
  not shown.
- Memory per server process: a background refresh every 60 seconds (`revalidate`, 15 to 60), a
  wait of up to 2 seconds (`timeout`) only when nothing is in memory, one request at a time, 30
  seconds of rest after a failure (or what `Retry-After` asks, up to 10 minutes), and the last
  good wall kept until it expires. Never throws; returns `null` in a browser.
- Framework adapters, with named exports only: `@submitator/badges/react` (`BadgeWall`,
  `SubmitatorBadges`), `@submitator/badges/vue` (`BadgeWall`), `@submitator/badges/svelte`
  (`BadgeWall`, Svelte 5 source) and `@submitator/badges/astro` (`BadgeWall`, `SubmitatorBadges`,
  Astro source). Each renders nothing for a null or missing wall.
- `wallToHtml` for any other server: one line of HTML with every value escaped.
- Two layouts: `marquee` (the default from 3 badges: CSS-only motion that pauses on hover and
  focus and stands still under reduced motion and in print) and `row`. One `<style>` element,
  a `nonce` option for CSP.
- Next.js: every page that renders the wall gets a lifetime of at most `revalidate`, also when
  the wall comes from memory; Cache Components through `"use cache"` with `cacheLife("minutes")`.
- The User-Agent names the package version and the framework, plus `dev` on development servers.
  The package reads only `NODE_ENV` and `NEXT_RUNTIME`.
- Runs on Node.js 20.9 or later, Bun, Deno and Cloudflare Workers. ESM only, with types, no
  runtime dependencies.
- Also exported: `parseWall`, `verifyEnvelope`, `layoutWall`, `styleText`, `CSS`, `DEFAULTS`,
  `LIMITS`, `PUBLIC_KEYS`, `VERSION`, `WALL_VERSION` and `DEFAULT_API_URL`.
