// The production public keys this package trusts: base64url without padding of
// the raw 32-byte Ed25519 keys, by keyId. Other keys come only through the
// `publicKeys` option, which needs a custom `apiUrl`.
//
// Both values are placeholders until the owner generates the keys (RELEASING.md).
// A placeholder never verifies anything, and scripts/check-keys.mjs fails the
// release while one is pinned.

export const PUBLIC_KEYS: Readonly<Record<string, string>> = Object.freeze({
  // Primary: signs every wall (its seed is Koyeb's BADGE_WALL_SIGNING_KEY).
  "k202611-a": "PLACEHOLDER",
  // Backup: kept offline by the owner; the server switches to it if the primary leaks.
  "k202611-b": "PLACEHOLDER",
});
