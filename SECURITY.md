# Security

## Reporting a vulnerability

Email vlad@submitator.com with what you found and how to reproduce it. Please do not open a
public issue, and give us the time to ship a fix before you publish anything. You get an answer
by email.

Security fixes go to the latest minor release of the current major version.

## Signing keys

Every wall is an envelope `{ payload, signature, keyId }`: an Ed25519 signature over the exact
UTF-8 bytes of the payload (CONTRACT.md section 3). The package pins the production public keys
in `src/keys.ts`. Public keys are base64url without padding of the raw 32-byte key.

| keyId            | Role                                                           | Public key                                    |
| ---------------- | -------------------------------------------------------------- | --------------------------------------------- |
| `k202611-a`      | Production primary: signs every wall                           | `cZ9kHN37kpohJeeYqIoUBOBY2Km05ZAjVclHOuptGbk` |
| `k202611-b`      | Production backup: kept offline, used if the primary leaks     | `0MkT61zlC2Pkcs3W0VV3lXD7AV8hzTicQnlUgkYt5o8` |
| `test-rfc8032-1` | Tests and local development only, never accepted in production | `11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo` |

The owner generated the production keys once, on 2026-10-31 (RELEASING.md). The release check
(`npm run check:keys`) fails if `src/keys.ts` ever pins a placeholder, a malformed key or the
test key.

`test-rfc8032-1` is the key of RFC 8032 section 7.1, TEST 1: public on purpose, so anyone can
check the test vector (`test/fixtures/contract-v1/vector.json`). The package accepts a key it
does not pin only through the `publicKeys` option, and refuses that option for our production API:
no `apiUrl`, or any `apiUrl` on `api.submitator.com` (with a path, a port or a trailing dot too).

## What the package trusts, and what it does not

- It trusts a wall only when the signature verifies against a pinned key. TLS alone is not
  enough: someone who controls the API host but not the signing key cannot forge a wall.
- It checks every badge against the contract (tags, attributes, URLs, styles, structure, sizes)
  and leaves out any badge that fails. The server runs the same checks before it signs.
- The React, Vue, Svelte and Astro components write elements through the framework's own
  escaping, never HTML strings. `wallToHtml`, for servers without a framework, returns one HTML
  string in which every text and attribute value is escaped; the only raw text in it is the
  package's own stylesheet. Either way the wall's root carries `contain: paint` in its own
  `style` attribute, so no badge can draw outside the strip, even where a
  Content-Security-Policy blocks the wall's `<style>` element.
- It sends no cookies, reads no secrets and no configuration (of your environment variables only
  `NODE_ENV` and `NEXT_RUNTIME`: to mark development servers, and to spot Next.js so it can use
  Next's cache), has no telemetry, and never fetches from a browser.

## If a key leaks

- The primary: our server switches to the backup `k202611-b` at once. Every version of the
  package already pins it, so no customer needs an update. A minor release then replaces the
  leaked key with a new backup, and the versions that pin the leaked key are deprecated on npm.
- Both keys: a release with new keys. Older versions show no badges once their last good wall
  expires (7 days).

RELEASING.md has the step-by-step rotation runbook.
