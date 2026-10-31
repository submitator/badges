import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  ATTRIBUTES,
  DEFAULTS,
  FRAMEWORK_PATTERN,
  FRAMEWORKS,
  KEY_ID_PATTERN,
  LIMITS,
  STYLE_FORBIDDEN_TOKENS,
  STYLE_PROPERTY_PATTERN,
  TAGS,
  TIMESTAMP_PATTERN,
  URL_PATTERN,
} from "../../src/contract.js";
import { PUBLIC_KEYS } from "../../src/keys.js";

// CONTRACT.md is the canon; these tests read it, so the code cannot drift from it.
const contract = readFileSync(new URL("../../CONTRACT.md", import.meta.url), "utf8");
const flat = contract.replace(/\s+/g, " ");

/** The backticked words of the first match of `pattern` in CONTRACT.md. */
function ticked(pattern: RegExp): string[] {
  const match = pattern.exec(flat);
  if (!match?.[1]) throw new Error(`CONTRACT.md has no ${pattern}`);
  return [...match[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]!);
}

describe("the code says what CONTRACT.md says", () => {
  test("the attribute allowlist", () => {
    const [list] = ticked(/Allowed names, and only these: (`[^`]+`)/);
    expect(list!.split(" ")).toEqual(ATTRIBUTES);
  });

  test("the tags", () => {
    expect(ticked(/- `t`: (.*?)\. - `a`:/)).toEqual(TAGS);
  });

  test("the framework tokens, all matching the token pattern", () => {
    const listed = ticked(/one of (`next`.*?`other`)\./);
    expect(listed).toEqual(FRAMEWORKS);
    expect(FRAMEWORKS.every((name) => FRAMEWORK_PATTERN.test(name))).toBe(true);
    expect(flat).toContain(`\`${FRAMEWORK_PATTERN.source}\``);
  });

  test("the production key ids", () => {
    const ids = [...contract.matchAll(/^\| `(k\d{6}-[a-z])` \|/gm)].map((m) => m[1]);
    expect(ids).toEqual(Object.keys(PUBLIC_KEYS));
  });

  test("the patterns", () => {
    for (const pattern of [KEY_ID_PATTERN, STYLE_PROPERTY_PATTERN]) {
      expect(flat).toContain(pattern.source);
    }
    expect(flat).toContain(`/${STYLE_FORBIDDEN_TOKENS.source}/${STYLE_FORBIDDEN_TOKENS.flags}`);
  });

  // Browsers read url(, @import and the URL scheme in any case: both checks must too.
  test("the style tokens and the URL rule ignore case", () => {
    expect(STYLE_FORBIDDEN_TOKENS.flags).toBe("i");
    expect(URL_PATTERN.flags).toBe("i");
    expect(flat).toContain(`\`${URL_PATTERN.source.replaceAll("\\/", "/")}\` (case-insensitive)`);
  });

  test("the timestamp pattern accepts and refuses what the contract's does", () => {
    const [source] = ticked(/`issuedAt`, `expiresAt`: UTC, (`[^`]+`)/);
    const canon = new RegExp(source!);
    for (const sample of [
      "2026-11-01T00:00:00Z",
      "2026-11-01T00:00:00.5Z",
      "2026-11-01T00:00:00.123456Z",
      "2026-11-01T00:00:00.1234567Z",
      "2026-11-01T00:00:00",
      "2026-11-01 00:00:00Z",
      "2026-11-01T00:00:00+00:00",
      "26-11-01T00:00:00Z",
    ]) {
      expect(TIMESTAMP_PATTERN.test(sample), sample).toBe(canon.test(sample));
    }
  });

  test("the package-side limits", () => {
    expect(LIMITS).toEqual({
      bodyBytes: 1_048_576,
      payloadBytes: 524_288,
      badges: 200,
      rootNodes: 16,
      nodesPerBadge: 300,
      depth: 16,
      text: 1000,
      attrValue: 2048,
      pathData: 8192,
      styleDecls: 64,
      styleValue: 1024,
      name: 120,
      host: 253,
      wallLifetimeMs: 8 * 86_400_000,
    });
    for (const figure of ["524,288", "1,048,576", "at most 200", "300 (package)", "at most 64"]) {
      expect(flat).toContain(figure);
    }
  });

  test("the defaults the docs print", () => {
    expect(DEFAULTS).toEqual({
      apiUrl: "https://api.submitator.com",
      revalidateSeconds: 60,
      timeoutMs: 2000,
      wallTtlDays: 7,
    });
    expect(Object.isFrozen(DEFAULTS)).toBe(true);
    expect(flat).toContain("`apiUrl` defaults to `https://api.submitator.com`");
  });
});
