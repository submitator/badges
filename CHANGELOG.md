# Changelog

All notable changes to `@submitator/badges` are listed here. The package follows
[Semantic Versioning](https://semver.org/).

## Unreleased

- First version: fetch, verify and render the signed badge wall (contract v1).
- Framework adapters, with named exports only: `@submitator/badges/react` (`BadgeWall`,
  `SubmitatorBadges`), `@submitator/badges/vue` (`BadgeWall`), `@submitator/badges/svelte`
  (`BadgeWall`, Svelte 5 source) and `@submitator/badges/astro` (`BadgeWall`, `SubmitatorBadges`,
  Astro source). Each renders nothing for a null or missing wall.
