// Writes the hand-written fixtures of test/fixtures/contract-v1/ (walls/hand-*.json
// and envelopes/*.json) from scripts/fixture-cases.mjs. Deterministic: Ed25519
// signatures with the RFC 8032 test key never change. The unit tests check that
// the committed files equal what this script builds.
//
//   node scripts/write-fixtures.mjs
import { createPrivateKey, sign } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { ENVELOPE_CASES, NOW, PROJECT, TEST_KEY, WALL_CASES } from "./fixture-cases.mjs";

export const FIXTURES = new URL("../test/fixtures/contract-v1/", import.meta.url);
const DEL_ESCAPE = String.fromCharCode(92) + "u007f";

/** Signs a payload's UTF-8 bytes with the test key; base64url without padding. */
export function signWithTestKey(payload) {
  const key = createPrivateKey({
    key: { kty: "OKP", crv: "Ed25519", d: TEST_KEY.seed, x: TEST_KEY.publicKey },
    format: "jwk",
  });
  return sign(null, Buffer.from(payload, "utf8"), key).toString("base64url");
}

/** Pretty JSON with a final newline; DEL is escaped so no file holds a raw control character. */
function toJson(value) {
  return `${JSON.stringify(value, null, 2).replaceAll(String.fromCharCode(0x7f), DEL_ESCAPE)}\n`;
}

/** Every hand-written fixture as { path, text }, path relative to FIXTURES. */
export function buildFixtures() {
  const files = [];
  for (const wall of WALL_CASES) {
    const payload = typeof wall.payload === "string" ? wall.payload : JSON.stringify(wall.payload);
    files.push({
      path: `walls/${wall.name}.json`,
      text: toJson({
        name: wall.name,
        now: wall.now ?? NOW,
        project: wall.project ?? PROJECT,
        payload,
        expect: wall.expect,
      }),
    });
  }

  const base = WALL_CASES.find((wall) => wall.name === "hand-three-badges");
  const payload = JSON.stringify(base.payload);
  const signed = { payload, signature: signWithTestKey(payload), keyId: TEST_KEY.keyId };
  for (const envelope of ENVELOPE_CASES) {
    files.push({
      path: `envelopes/${envelope.name}.json`,
      text: toJson({
        name: envelope.name,
        project: PROJECT,
        now: NOW,
        publicKeys: { [TEST_KEY.keyId]: TEST_KEY.publicKey },
        body: JSON.stringify(envelope.envelope(signed)),
        expect: envelope.expect,
      }),
    });
  }
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const dir of ["walls", "envelopes"]) mkdirSync(new URL(dir, FIXTURES), { recursive: true });
  const files = buildFixtures();
  for (const file of files) writeFileSync(new URL(file.path, FIXTURES), file.text);
  console.log(`wrote ${files.length} fixtures`);
}
