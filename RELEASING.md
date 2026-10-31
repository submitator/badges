# Releasing @submitator/badges

The owner's runbook. Nothing reaches npm users without you: every version is first staged
(`npm stage publish`), and it goes live only when you approve it on npmjs.com with 2FA.

## Where things stand

Done on 2026-10-31:

- npm: the user `submitator` (its scope is `@submitator`, as for `submitator-mcp`), with 2FA for
  sign-in and writes. There is no npm organization.
- GitHub: the repo `submitator/badges`, private for now, with the environment `npm` (deployment
  tags `v*`).

Still to do, in this order: the production keys (section 1), the first release from your laptop
(section 2), and trusted publishing once the repo is public (section 3).

You need npm 11.15.0 or later and Node.js 22.14 or later for `npm stage` (`npm -v`; to update:
`npm install --global npm@latest`).

## 1. Production keys (once, before 1.0.0)

The backend generates them. Never paste a seed into a chat, an issue, a commit or a terminal
that records its output: the task writes each seed to a file only you can read, and prints only
the public key.

1. In the backend, run it twice:

   ```sh
   bin/rails badge_wall:keygen KEY_ID=k202611-a OUT=~/badge-wall-keys
   bin/rails badge_wall:keygen KEY_ID=k202611-b OUT=~/badge-wall-keys
   ```

2. Koyeb: `BADGE_WALL_SIGNING_KEY` = the content of `k202611-a.seed`, and
   `BADGE_WALL_KEY_ID=k202611-a`.
3. Your password manager: the content of `k202611-b.seed`, the offline backup. It is never
   deployed unless the primary leaks.
4. Delete `~/badge-wall-keys`.
5. Send the two public keys the task printed (they are not secret). They get pinned in
   `src/keys.ts`, listed in `SECURITY.md` and added to the backend's published keys, then
   `npm run check:keys` passes. Until then it fails, and so does every release.
6. After the backend deploy, on the Koyeb console, `bin/rails badge_wall:public_key` must say
   `published: yes`.

## 2. First release: 1.0.0 from your laptop

The repo is private, so this one goes out like `submitator-mcp`, from your machine, and has no
provenance. While it stays private, the README's links to repo files open GitHub from the npm
page and show visitors a 404; they work once the repo is public. CONTRACT.md and SECURITY.md
also ship in the package, so the npm page's Code tab and `node_modules` have them.

1. In `~/real_work/submitator-badges`, on an up-to-date `main` with a clean tree:

   ```sh
   npm ci
   npm run check:keys && npm run typecheck && npm test
   npm run lint:package && npm run pack:check && npm run test:smoke
   ```

2. In `CHANGELOG.md`, rename `## Unreleased` to `## 1.0.0 (<today>)`, add an empty
   `## Unreleased` above it, and commit.
3. `npm version 1.0.0`: writes the version to `package.json` and `src/version.ts`, commits and
   tags `v1.0.0`.
4. `npm stage publish --access public`. It first runs the package's `prepublishOnly` guard,
   which stops it while `src/keys.ts` pins a placeholder or the test key (`check-keys.mjs`), or
   while the version is one our server cannot read (`check-version.mjs`, CONTRACT.md section 9:
   at most 4 digits a part, and a prerelease like `rc.1`, never `rc-1`). Then it builds the
   package and prints `+ @submitator/badges@1.0.0 (staged with id <stage-id>)`. Because the
   package is new, npm also publishes a placeholder version `0.0.0-stage`, which is public; 1.0.0
   is not, yet.
5. Approve: npmjs.com, the package, the **Staged Packages** tab, **Approve**, then your 2FA code.
   Or in the terminal: `npm stage list @submitator/badges`, then
   `npm stage approve <stage-id>`. To look first: `npm stage view <stage-id>` and
   `npm stage download <stage-id>`. To drop it: `npm stage reject <stage-id>`.
6. Check: `npm view @submitator/badges version dist-tags` shows 1.0.0 as `latest`.
7. `npm deprecate @submitator/badges@0.0.0-stage "Placeholder. Use 1.0.0 or later."`
8. npmjs.com, the package, Settings, Publishing access: **Require two-factor authentication and
   disallow tokens**.
9. Push: `git push origin main && git push origin v1.0.0`. The release workflow sees that 1.0.0
   is already on npm, skips the npm step and leaves a draft GitHub release.

### Or, if the repo is public first: 1.0.0 through CI

Instead of the steps above. npm sets up a trusted publisher only for a package that already
exists, so a placeholder version goes first.

1. In an empty folder, a `package.json`:

   ```json
   {
     "name": "@submitator/badges",
     "version": "0.0.0",
     "description": "Reserved for the first release.",
     "license": "MIT",
     "repository": { "type": "git", "url": "git+https://github.com/submitator/badges.git" }
   }
   ```

   then `npm publish --access public` with your 2FA code.

2. The trusted publisher, allowed to stage only (section 3, step 1).
3. Within 2 days: the CHANGELOG, `npm version 1.0.0`, and
   `git push origin main && git push origin v1.0.0` (section 4, steps 1 to 3).
4. Approve the staged 1.0.0 (Staged Packages, Approve, 2FA, or `npm stage approve <stage-id>`).
   Check `npm view @submitator/badges version dist-tags` and the Provenance badge.
5. `npm deprecate @submitator/badges@0.0.0 "Placeholder. Use 1.0.0 or later."`
6. Settings, Publishing access: **Require two-factor authentication and disallow tokens**.

## 3. Trusted publishing, once the repo is public

From then on releases go out through `.github/workflows/release.yml`, with provenance and with
no npm token anywhere: npm trusts that workflow through OIDC, and only to stage.

1. npmjs.com, the package, Settings, **Trusted publishing**, GitHub Actions:
   - organization or user: `submitator`
   - repository: `badges`
   - workflow filename: `release.yml`
   - environment name: `npm`
   - allowed actions: **stage publish only**. Leave direct publishing off.

   Or in the terminal (npm 11.15.0 or later, 2FA):

   ```sh
   npm trust github @submitator/badges --repo submitator/badges --file release.yml --env npm --allow-stage-publish
   ```

2. Do step 1 right before a release, and push its tag within 2 days: npm drops a trusted
   publisher that has not been used by then. If that happens, delete it and add it again.
3. After the first release through CI, check the package page on npmjs.com for the
   **Provenance** badge. npm does not say outright that staged versions keep it: if it is
   missing, the landing page must not claim provenance.

## 4. Every release after that

1. `CHANGELOG.md`: move the `Unreleased` entries under `## X.Y.Z (<today>)`, and commit.
2. `npm version patch`, `minor` or `major` (prerelease: `npm version 1.2.0-rc.1`; it gets the
   dist-tag `next`). Keep to versions our server reads (CONTRACT.md section 9): at most 4 digits
   a part, and dots in the prerelease (`rc.1`, never `rc-1`). The release refuses any other.
3. `git push origin main && git push origin vX.Y.Z`
4. GitHub Actions, workflow **Release**: it checks the tag against `package.json`,
   `src/version.ts` and the server's version grammar, and takes the release notes from
   `CHANGELOG.md` (a missing `## X.Y.Z` section stops it there, before anything is staged). Then
   it checks the pinned keys, the types, the tests, the package lint, the tarball and the smoke
   test, runs `npm stage publish` on that tarball and opens a draft GitHub release with those
   notes.
5. Approve on npmjs.com (Staged Packages, Approve, 2FA) or with `npm stage approve <stage-id>`.
6. Check `npm view @submitator/badges version dist-tags` and the Provenance badge, then publish
   the draft GitHub release.

A bad release is never unpublished: `npm deprecate @submitator/badges@X.Y.Z "<why>, use X.Y.Z+1"`
and release a fix. Do not rerun a release job after it staged a version: reject the extra stage
if one appears.

## 5. Keys: rotation

**Planned rotation** (a new key id, such as `k202711-a`):

1. Generate the new key with `badge_wall:keygen` and keep its seed offline for now.
2. Pin its public key next to the current two (`src/keys.ts`, `SECURITY.md`, the backend's
   published keys) and release a minor.
3. Wait until the backend's install detection shows nearly every server on that version (at
   least 90 days).
4. Switch Koyeb to the new seed and key id.
5. In a later minor, remove the retired key.

**The primary leaked:**

1. Koyeb: `BADGE_WALL_SIGNING_KEY` = the seed of `k202611-b` from your password manager,
   `BADGE_WALL_KEY_ID=k202611-b`, and redeploy. Every version of the package already accepts
   it, so customers need nothing.
2. Generate a new backup, pin it, remove the leaked key from `src/keys.ts` and the backend's
   published keys, and release a minor.
3. `npm deprecate "@submitator/badges@<versions that pin the leaked key>" "Signing key rotated: update to X.Y.Z or later."`
4. Publish a GitHub security advisory.

**The backup leaked:** generate a new backup, pin it in place of the old one, release a minor.
The server keeps signing with the primary.

**Both keys are lost:** release a version with new keys. Older versions show no badges once
their last good wall expires (7 days): deprecate them.

**Anything wrong with the walls in production:** `BADGE_WALL=0` on Koyeb answers 503 to every
wall request. Installed packages keep showing their last good wall until it expires.
