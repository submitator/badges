import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { keyProblems, readPinnedKeys } from "../../scripts/check-keys.mjs";
import { PUBLIC_KEYS } from "../../src/keys.js";

const source = readFileSync(new URL("../../src/keys.ts", import.meta.url), "utf8");
const TEST_PUBLIC_KEY = "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo";
// Two valid Ed25519 public keys that are not the test key (RFC 8032 TEST 2 and TEST 3).
const KEY_A = "PUAXw-hDiVqStwqnTRt-vJyYLM8uxJaMwM1V8Sr0Zgw";
const KEY_B = "_FHNjmIYoaONpH7QAjDwWAgW7RO6MwOsXeuRFUiQgCU";

const keysSource = (entries: Array<[string, string]>): string =>
  `export const PUBLIC_KEYS: Readonly<Record<string, string>> = Object.freeze({\n${entries
    .map(([id, value]) => `  // a comment\n  "${id}": "${value}",`)
    .join("\n")}\n});\n`;

describe("pinned keys", () => {
  test("PUBLIC_KEYS holds exactly the two production key ids and no test key", () => {
    expect(Object.keys(PUBLIC_KEYS)).toEqual(["k202611-a", "k202611-b"]);
    expect(Object.values(PUBLIC_KEYS)).not.toContain(TEST_PUBLIC_KEY);
    expect(Object.isFrozen(PUBLIC_KEYS)).toBe(true);
  });

  test("the release check reads the same entries as the module", () => {
    expect(Object.fromEntries(readPinnedKeys(source))).toEqual(PUBLIC_KEYS);
  });

  test("the release check fails while a placeholder is pinned", () => {
    const problems = keyProblems(readPinnedKeys(source));
    if (Object.values(PUBLIC_KEYS).includes("PLACEHOLDER")) {
      expect(problems.join("\n")).toContain("placeholder");
    } else {
      expect(problems).toEqual([]);
    }
  });

  test("the release check passes two real keys", () => {
    const entries = readPinnedKeys(
      keysSource([
        ["k202611-a", KEY_A],
        ["k202611-b", KEY_B],
      ]),
    );
    expect(entries).toEqual([
      ["k202611-a", KEY_A],
      ["k202611-b", KEY_B],
    ]);
    expect(keyProblems(entries)).toEqual([]);
  });

  test.each([
    [
      "the test key",
      [
        ["k202611-a", TEST_PUBLIC_KEY],
        ["k202611-b", KEY_B],
      ],
    ],
    [
      "the test key id",
      [
        ["test-rfc8032-1", KEY_A],
        ["k202611-b", KEY_B],
      ],
    ],
    ["one key only", [["k202611-a", KEY_A]]],
    [
      "the same key twice",
      [
        ["k202611-a", KEY_A],
        ["k202611-b", KEY_A],
      ],
    ],
    [
      "a non-canonical key",
      [
        ["k202611-a", `${KEY_A.slice(0, 42)}x`],
        ["k202611-b", KEY_B],
      ],
    ],
  ] as Array<[string, Array<[string, string]>]>)(
    "the release check refuses %s",
    (_label, entries) => {
      expect(keyProblems(readPinnedKeys(keysSource(entries)))).not.toEqual([]);
    },
  );
});
