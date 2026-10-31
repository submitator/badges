// Fails while src/keys.ts pins a placeholder, a malformed key or the test key
// instead of the production public keys. release.yml runs it before publishing,
// and so do npm publish and npm stage publish from a checkout (prepublishOnly).
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const KEY_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
const PUBLIC_KEY = /^[A-Za-z0-9_-]{43}$/;
// RFC 8032 TEST 1: tests and local development only.
const TEST_KEY_ID = "test-rfc8032-1";
const TEST_PUBLIC_KEY = "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo";

/** The `"keyId": "value"` entries of the PUBLIC_KEYS object in keys.ts source. */
export function readPinnedKeys(source) {
  const start = source.indexOf("PUBLIC_KEYS");
  const open = source.indexOf("{", start);
  const close = source.indexOf("}", open);
  if (start < 0 || open < 0 || close < 0) return [];
  const body = source
    .slice(open + 1, close)
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
  return [...body.matchAll(/"([^"]*)"\s*:\s*"([^"]*)"/g)].map((match) => [match[1], match[2]]);
}

function isPublicKey(value) {
  if (!PUBLIC_KEY.test(value)) return false;
  const raw = Buffer.from(value, "base64url");
  return raw.length === 32 && raw.toString("base64url") === value;
}

/** The problems with the pinned keys (empty when they are ready to release). */
export function keyProblems(entries) {
  const problems = [];
  if (entries.length < 2)
    problems.push("pin at least two keys: the primary and the offline backup");
  const values = new Set();
  for (const [id, value] of entries) {
    if (!KEY_ID.test(id)) problems.push(`${id}: the key id is malformed`);
    if (id === TEST_KEY_ID || value === TEST_PUBLIC_KEY) {
      problems.push(`${id}: the test key never ships`);
    } else if (!isPublicKey(value)) {
      problems.push(`${id}: "${value}" is a placeholder, not a 32-byte base64url public key`);
    }
    if (isPublicKey(value) && values.has(value))
      problems.push(`${id}: the same key is pinned twice`);
    values.add(value);
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = readFileSync(new URL("../src/keys.ts", import.meta.url), "utf8");
  const problems = keyProblems(readPinnedKeys(source));
  if (problems.length > 0) {
    for (const problem of problems) console.error(`src/keys.ts: ${problem}`);
    process.exit(1);
  }
  console.log("keys check: ok");
}
