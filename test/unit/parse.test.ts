import { describe, expect, test } from "vitest";
import {
  BAD_BADGES,
  DIRECTORY_BADGES,
  EDGE_BADGES,
  PROJECT,
  SKIP_CASES,
  selfLink,
  selfPill,
} from "../../scripts/fixture-cases.mjs";
import { LIMITS } from "../../src/contract.js";
import {
  checkBadge,
  isParsedWall,
  parseWall,
  parseWallDetailed,
  renderableBadges,
} from "../../src/parse.js";
import type { Wall } from "../../src/types.js";
import { vector, wallFixtures } from "../support/fixtures.js";

const NOW = Date.parse("2026-11-02T00:00:00Z");

function payloadOf(badges: unknown[], overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    v: 1,
    project: PROJECT,
    issuedAt: "2026-11-01T00:00:00Z",
    expiresAt: "2026-11-08T00:00:00Z",
    badges,
    ...overrides,
  });
}

function parse(badges: unknown[], overrides: Record<string, unknown> = {}, now = NOW) {
  return parseWallDetailed(payloadOf(badges, overrides), { project: PROJECT, now });
}

/** A directory badge around one tree. */
function directory(tree: unknown[], extra: Record<string, unknown> = {}) {
  return {
    kind: "directory",
    id: "d_00000000-0000-4000-8000-000000000001",
    name: "Dir",
    ...extra,
    tree,
  };
}

const link = (children: unknown[] = ["Badge"], a: Record<string, string> = {}) => ({
  t: "a",
  a: { href: "https://dir.example.com", ...a },
  c: children,
});

function expectKept(badge: unknown) {
  const result = checkBadge(badge);
  if (!result.ok) throw new Error(`skipped: ${result.reason}: ${result.detail}`);
  return result.badge;
}

function isDeepFrozen(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return true;
  if (!Object.isFrozen(value)) return false;
  return Object.values(value).every(isDeepFrozen);
}

describe("the shared vector payload", () => {
  test("parses into the self badge and the custom badge", () => {
    const v = vector();
    const wall = parseWall(v.payload, { project: PROJECT, now: NOW });
    expect(wall?.badges.map((badge) => [badge.kind, badge.id, badge.name])).toEqual([
      ["self", "self", undefined],
      ["custom", "c_3f2b1a4e-5d6c-4b7a-8e9f-0a1b2c3d4e5f", "Мой бейдж ✓ café"],
    ]);
    expect(wall?.skipped).toBe(0);
  });
});

describe("wall fixtures", () => {
  test.each(wallFixtures().map((fixture) => [fixture.file, fixture] as const))(
    "%s",
    (_file, fixture) => {
      const result = parseWallDetailed(fixture.payload, {
        project: fixture.project,
        now: Date.parse(fixture.now),
      });
      if (!fixture.expect.ok) {
        expect(result).toMatchObject({ ok: false, reason: fixture.expect.reason });
        return;
      }
      if (!result.ok) throw new Error(`refused: ${result.reason}: ${result.detail}`);
      expect(result.wall.badges.map((badge) => badge.id ?? null)).toEqual(fixture.expect.ids);
      expect(result.wall.skipped).toBe(fixture.expect.skipped);
      expect(result.skips).toHaveLength(fixture.expect.skipped);
    },
  );

  test("hand-skips skips every bad badge for the rule its name gives", () => {
    const fixture = wallFixtures().find((wall) => wall.name === "hand-skips");
    const result = parseWallDetailed(fixture!.payload, { project: PROJECT, now: NOW });
    if (!result.ok) throw new Error(result.reason);
    const expected = [...SKIP_CASES, ...BAD_BADGES].map(([, reason]) => reason);
    expect(result.skips.map((skip) => skip.reason)).toEqual(expected);
  });
});

describe("badge-level rules: the badge is skipped, the others kept", () => {
  test.each(SKIP_CASES.map(([rule, reason, tree]) => [rule, reason, tree] as const))(
    "skips %s (%s)",
    (_rule, reason, tree) => {
      expect(checkBadge(directory(tree as unknown[]))).toMatchObject({ ok: false, reason });
    },
  );

  test.each(BAD_BADGES.map(([rule, reason, badge]) => [rule, reason, badge] as const))(
    "skips %s (%s)",
    (_rule, reason, badge) => {
      expect(checkBadge(badge)).toMatchObject({ ok: false, reason });
    },
  );

  test("keeps the order of the badges around a skipped one", () => {
    const bad = directory([{ t: "div" }], { id: "d_00000000-0000-4000-8000-000000000009" });
    const result = parse([selfLink(), bad, DIRECTORY_BADGES[0], bad, DIRECTORY_BADGES[1]]);
    if (!result.ok) throw new Error(result.reason);
    expect(result.wall.badges.map((badge) => badge.id)).toEqual([
      "self",
      DIRECTORY_BADGES[0]!.id,
      DIRECTORY_BADGES[1]!.id,
    ]);
    expect(result.wall.skipped).toBe(2);
    expect(result.skips.map((skip) => skip.index)).toEqual([1, 3]);
  });

  test("every realistic badge passes", () => {
    for (const badge of [selfPill(), selfLink(), ...DIRECTORY_BADGES, ...EDGE_BADGES]) {
      expect(checkBadge(badge).ok).toBe(true);
    }
  });
});

describe("limits, at the edge and one past it", () => {
  const nested = (depth: number): unknown => {
    let node: unknown = "deep";
    for (let i = 1; i < depth; i += 1) node = { t: "span", c: [node] };
    return node;
  };

  test("16 root nodes pass, 17 do not", () => {
    expect(checkBadge(directory(Array.from({ length: 16 }, () => link()))).ok).toBe(true);
    expect(checkBadge(directory(Array.from({ length: 17 }, () => link())))).toMatchObject({
      reason: "limits",
    });
  });

  test("depth 16 passes (root nodes are depth 1), 17 does not", () => {
    expect(checkBadge(directory([nested(16)])).ok).toBe(true);
    expect(checkBadge(directory([nested(17)]))).toMatchObject({ reason: "limits" });
  });

  test("300 nodes pass, text and elements alike; 301 do not", () => {
    const spans = (n: number) => Array.from({ length: n }, () => ({ t: "span", c: ["x"] }));
    expect(checkBadge(directory([{ t: "span", c: [...spans(149), "tail"] }])).ok).toBe(true);
    expect(checkBadge(directory([{ t: "span", c: spans(150) }]))).toMatchObject({
      reason: "limits",
    });
  });

  test("text counts characters, not UTF-16 units", () => {
    const astral = "😀".repeat(1000);
    expect(astral.length).toBe(2000);
    expect(checkBadge(directory([{ t: "span", c: [astral] }])).ok).toBe(true);
    expect(checkBadge(directory([{ t: "span", c: [`${astral}a`] }]))).toMatchObject({
      reason: "limits",
    });
  });

  test("attribute values up to 2048 characters, d up to 8192", () => {
    const span = (title: string) => ({ t: "span", a: { title }, c: ["x"] });
    const path = (d: string) => ({ t: "svg", c: [{ t: "path", a: { d } }] });
    expect(checkBadge(directory([span("a".repeat(2048))])).ok).toBe(true);
    expect(checkBadge(directory([span("a".repeat(2049))]))).toMatchObject({ reason: "limits" });
    expect(checkBadge(directory([path("M".repeat(8192))])).ok).toBe(true);
    expect(checkBadge(directory([path("M".repeat(8193))]))).toMatchObject({ reason: "limits" });
  });

  test("64 style declarations and 1024-character values pass", () => {
    const decls = Array.from({ length: 64 }, () => ["color", "red"]);
    expect(checkBadge(directory([{ t: "span", s: decls, c: ["x"] }])).ok).toBe(true);
    const long = [["font-family", "a".repeat(1024)]];
    expect(checkBadge(directory([{ t: "span", s: long, c: ["x"] }])).ok).toBe(true);
  });

  test("name up to 120 characters and host up to 253 are kept", () => {
    const name = "✓".repeat(119) + "😀";
    const host = `${"a".repeat(249)}.com`;
    const badge = expectKept(directory([link()], { name, host }));
    expect(badge.name).toBe(name);
    expect(badge.host).toBe(host);
    const over = expectKept(directory([link()], { name: `${name}x`, host: `a${host}` }));
    expect(over.name).toBeUndefined();
    expect(over.host).toBeUndefined();
  });
});

describe("what passes as sent", () => {
  test("keeps raw spaces, http:// and an uppercase scheme in URLs", () => {
    for (const href of [
      "https://dir.example.com/p/AI Tool",
      "http://easydofollow.dev/x",
      "HTTPS://Dir.Example.com",
    ]) {
      const badge = expectKept(directory([{ t: "a", a: { href }, c: ["x"] }]));
      expect(badge.tree[0]).toEqual({ t: "a", a: { href }, c: ["x"] });
    }
  });

  test("allows empty attribute values such as alt", () => {
    const img = { t: "img", a: { src: "https://dir.example.com/b.svg", alt: "" } };
    expect(expectKept(directory([img])).tree).toEqual([img]);
  });

  test("allows TAB, LF and CR in text and attribute values", () => {
    const span = { t: "span", a: { title: "a\tb\nc\rd" }, c: ["one\ttwo\nthree\r"] };
    expect(expectKept(directory([span])).tree).toEqual([span]);
  });

  test("keeps duplicate style declarations in source order", () => {
    const s = [
      ["color", "red"],
      ["border", "1px solid #000"],
      ["color", "blue"],
    ];
    expect(expectKept(directory([{ t: "span", s, c: ["x"] }])).tree[0]).toEqual({
      t: "span",
      s,
      c: ["x"],
    });
  });

  test("drops spaces around a style value", () => {
    const badge = expectKept(directory([{ t: "span", s: [["color", "  red "]], c: ["x"] }]));
    expect(badge.tree[0]).toEqual({ t: "span", s: [["color", "red"]], c: ["x"] });
  });

  test("allows quotes, nested parentheses and custom properties in styles", () => {
    const s = [
      ["font-family", '"Segoe UI",sans-serif'],
      ["width", "calc(100% - var(--gap, 4px))"],
      ["--badge-accent", "#CCFF00"],
      ["quotes", "'(' ')'"],
      ["-webkit-text-size-adjust", "100%"],
      ["position", "relative"],
    ];
    expect(checkBadge(directory([{ t: "span", s, c: ["x"] }])).ok).toBe(true);
  });

  test("allows both markers on the self badge", () => {
    const a = {
      t: "a",
      a: { href: `https://submitator.com?ref=${PROJECT}`, "data-badge-ref": PROJECT },
      c: ["x"],
    };
    expect(checkBadge({ kind: "self", id: "self", tree: [a] }).ok).toBe(true);
  });

  test("drops empty a, s and c from the element it returns", () => {
    const badge = expectKept(directory([{ t: "span", a: {}, s: [], c: [] }]));
    expect(badge.tree).toEqual([{ t: "span" }]);
  });
});

describe("lenient fields: dropped, the badge kept", () => {
  test.each([
    ["an id that is not a UUID", { id: "d_not-a-uuid" }, "id"],
    ["an id with capitals", { id: "d_00000000-0000-4000-8000-00000000000A" }, "id"],
    ["an id that is a number", { id: 7 }, "id"],
    ["an empty name", { name: "" }, "name"],
    ["a name with a control character", { name: "a\x07b" }, "name"],
    ["a name with DEL", { name: "a\x7fb" }, "name"],
    ["a host with a space", { host: "dir example.com" }, "host"],
    ["a host with a slash", { host: "dir.example.com/p" }, "host"],
    ["a host with a question mark", { host: "dir.example.com?x" }, "host"],
    ["a host with a hash", { host: "dir.example.com#x" }, "host"],
    ["an empty host", { host: "" }, "host"],
  ])("%s", (_label, extra, field) => {
    const badge = expectKept(directory([link()], { host: "dir.example.com", ...extra }));
    expect(badge).not.toHaveProperty(field);
    expect(badge.tree).toHaveLength(1);
  });
});

describe("wall-level rules", () => {
  test("accepts fractional seconds", () => {
    const result = parse([selfLink()], {
      issuedAt: "2026-11-01T00:00:00.5Z",
      expiresAt: "2026-11-08T00:00:00.123456Z",
    });
    expect(result.ok).toBe(true);
  });

  test.each([
    ["no Z", "2026-11-01T00:00:00"],
    ["a lowercase z", "2026-11-01T00:00:00z"],
    ["a space for T", "2026-11-01 00:00:00Z"],
    ["7 fraction digits", "2026-11-01T00:00:00.1234567Z"],
    ["month 13", "2026-13-01T00:00:00Z"],
    ["hour 24", "2026-11-01T24:00:00Z"],
    ["second 60", "2026-11-01T00:00:60Z"],
    ["29 February in a common year", "2027-02-29T00:00:00Z"],
  ])("refuses an issuedAt with %s", (_label, issuedAt) => {
    expect(parse([selfLink()], { issuedAt })).toMatchObject({ ok: false, reason: "timestamps" });
  });

  test("accepts 29 February in a leap year", () => {
    const result = parse(
      [selfLink()],
      { issuedAt: "2028-02-29T00:00:00Z", expiresAt: "2028-03-07T00:00:00Z" },
      Date.parse("2028-03-01T00:00:00Z"),
    );
    expect(result.ok).toBe(true);
  });

  test("a wall lives exactly 8 days at most", () => {
    const eightDays = { expiresAt: "2026-11-09T00:00:00Z" };
    const overByOneMicrosecond = { expiresAt: "2026-11-09T00:00:00.000001Z" };
    expect(parse([selfLink()], eightDays).ok).toBe(true);
    expect(parse([selfLink()], overByOneMicrosecond)).toMatchObject({ reason: "lifetime" });
  });

  test("a wall is valid until the millisecond before expiresAt", () => {
    const expires = Date.parse("2026-11-08T00:00:00Z");
    expect(parse([selfLink()], {}, expires - 1).ok).toBe(true);
    expect(parse([selfLink()], {}, expires)).toMatchObject({ reason: "expired" });
  });

  test("an issuedAt in the future is not refused", () => {
    expect(parse([selfLink()], {}, Date.parse("2026-10-31T00:00:00Z")).ok).toBe(true);
  });

  test("200 badges pass, 201 refuse the wall", () => {
    const badges = (n: number) => Array.from({ length: n }, () => selfLink());
    expect(parse(badges(200)).ok).toBe(true);
    expect(parse(badges(201))).toMatchObject({ ok: false, reason: "limits" });
  });

  test("v must be the number 1", () => {
    expect(parse([selfLink()], { v: "1" })).toMatchObject({ reason: "version" });
  });

  test("the requested project is lowercased before the comparison", () => {
    const result = parseWallDetailed(payloadOf([selfLink()]), {
      project: PROJECT.toUpperCase(),
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });

  test("a requested project that is not a UUID refuses the wall", () => {
    const result = parseWallDetailed(payloadOf([selfLink()]), { project: "my-project", now: NOW });
    expect(result).toMatchObject({ ok: false, reason: "project" });
  });

  test.each(["", "null", "[]", '"wall"', "{", "\u{feff}{}", "1e999"])(
    "refuses the payload %j without throwing",
    (payload) => {
      expect(parseWall(payload, { project: PROJECT, now: NOW })).toBeNull();
    },
  );
});

describe("the returned wall", () => {
  test("is deep-frozen plain JSON with no undefined value", () => {
    const result = parse([selfPill(), ...DIRECTORY_BADGES, ...EDGE_BADGES]);
    if (!result.ok) throw new Error(result.reason);
    const wall = result.wall;
    expect(isDeepFrozen(wall)).toBe(true);
    expect(JSON.parse(JSON.stringify(wall))).toEqual(wall);
    expect(JSON.stringify(wall)).not.toContain("undefined");
    expect(Object.keys(wall)).toEqual([
      "v",
      "project",
      "issuedAt",
      "expiresAt",
      "badges",
      "skipped",
    ]);
  });

  test("is marked as parsed; a JSON copy of it is not", () => {
    const wall = parseWall(payloadOf([selfLink()]), { project: PROJECT, now: NOW });
    expect(isParsedWall(wall)).toBe(true);
    expect(isParsedWall(JSON.parse(JSON.stringify(wall)))).toBe(false);
  });

  test("gives expiresAt in milliseconds, rounded up", () => {
    const result = parse([selfLink()], { expiresAt: "2026-11-08T00:00:00.0005Z" });
    expect(result.ok && result.expiresAtMs).toBe(Date.parse("2026-11-08T00:00:00Z") + 1);
  });

  test("keeps badge keys in contract order", () => {
    const badge = expectKept({
      tree: [link()],
      host: "dir.example.com",
      name: "Dir",
      id: "self",
      kind: "self",
    });
    expect(Object.keys(badge)).toEqual(["kind", "id", "name", "host", "tree"]);
  });
});

describe("renderableBadges: the render guard", () => {
  const wall = parseWall(payloadOf([selfPill(), ...DIRECTORY_BADGES]), {
    project: PROJECT,
    now: NOW,
  }) as Wall;

  test("trusts a wall from parseWall as it is", () => {
    expect(renderableBadges(wall)).toBe(wall.badges);
  });

  test("re-checks a wall that went through JSON and finds the same badges", () => {
    const copy = JSON.parse(JSON.stringify(wall)) as Wall;
    expect(renderableBadges(copy)).toEqual(wall.badges);
  });

  test("drops a badge tampered with after parsing, keeps the rest", () => {
    const copy = JSON.parse(JSON.stringify(wall)) as { badges: Array<{ tree: unknown[] }> };
    copy.badges[1]!.tree = [{ t: "a", a: { href: "javascript:alert(1)" }, c: ["x"] }];
    const badges = renderableBadges(copy);
    expect(badges?.map((badge) => badge.id)).toEqual(
      wall.badges.filter((_, index) => index !== 1).map((badge) => badge.id),
    );
  });

  test("remembers the result per object", () => {
    const copy = JSON.parse(JSON.stringify(wall)) as Wall;
    expect(renderableBadges(copy)).toBe(renderableBadges(copy));
  });

  test.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "wall"],
    ["no badges", { v: 1 }],
    ["v 2", { v: 2, badges: [] }],
    ["201 badges", { v: 1, badges: Array.from({ length: LIMITS.badges + 1 }, () => selfLink()) }],
  ])("gives null for %s", (_label, value) => {
    expect(renderableBadges(value)).toBeNull();
  });

  test("never throws, even on an object whose getters throw", () => {
    const hostile = {
      v: 1,
      get badges(): never {
        throw new Error("boom");
      },
    };
    expect(renderableBadges(hostile)).toBeNull();
  });
});
