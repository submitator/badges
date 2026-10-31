// The production public keys this package trusts: base64url without padding of
// the raw 32-byte Ed25519 keys, by keyId. Other keys come only through the
// `publicKeys` option, which needs a custom `apiUrl`.
//
// The owner generated both on 2026-10-31 (RELEASING.md, section 1); the backend
// signs only with a key it lists here too. scripts/check-keys.mjs fails the
// release if a placeholder, a malformed key or the test key is ever pinned.

export const PUBLIC_KEYS: Readonly<Record<string, string>> = Object.freeze({
  // Primary: signs every wall (its seed is Koyeb's BADGE_WALL_SIGNING_KEY).
  "k202611-a": "cZ9kHN37kpohJeeYqIoUBOBY2Km05ZAjVclHOuptGbk",
  // Backup: kept offline by the owner; the server switches to it if the primary leaks.
  "k202611-b": "0MkT61zlC2Pkcs3W0VV3lXD7AV8hzTicQnlUgkYt5o8",
});
