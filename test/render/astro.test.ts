// Astro components through the container API, compiled by Astro's own Vite
// setup (vitest.astro.config.ts).
import { readFileSync } from "node:fs";
import { experimental_AstroContainer } from "astro/container";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { BadgeWall, SubmitatorBadges } from "../../astro/index.js";
import { selfLink } from "../../scripts/fixture-cases.mjs";
import { signWithTestKey } from "../../scripts/write-fixtures.mjs";
import { parseWall } from "../../src/parse.js";
import type { Wall } from "../../src/types.js";
import { testKeys } from "../support/fixtures.js";
import { attr, describeWallRendering, elementsOf, visible, wallRoot } from "../support/render.js";

let container: experimental_AstroContainer;

beforeAll(async () => {
  container = await experimental_AstroContainer.create();
});

describeWallRendering({
  render: (wall, { layout, className, nonce } = {}) =>
    container.renderToString(BadgeWall, { props: { wall, layout, class: className, nonce } }),
  dedupesStyles: true,
});

describe("attribute escaping", () => {
  // Astro 4 and 5 write a plain string that is an http(s) URL holding "&"
  // without escaping it. Node.astro hands Astro String objects instead. This
  // Astro (7) escapes either way, so the first test below cannot fail here:
  // examples/astro4-floor and astro5-floor run the same URL on 4 and 5 in CI.
  const HOSTILE = 'https://x.example/?a=1&b=" onmouseover="alert(1)';

  function hostileWall(): Wall {
    const project = "00000000-0000-4000-8000-0000000000cc";
    const payload = JSON.stringify({
      v: 1,
      project,
      issuedAt: "2026-11-01T00:00:00Z",
      expiresAt: "2026-11-08T00:00:00Z",
      badges: [
        {
          kind: "directory",
          tree: [{ t: "a", a: { href: HOSTILE, title: HOSTILE }, c: ["x"] }],
        },
      ],
    });
    const wall = parseWall(payload, { project, now: Date.parse("2026-11-02T00:00:00Z") });
    if (wall === null || wall.badges.length !== 1) throw new Error("the hostile wall is invalid");
    return wall;
  }

  test("a URL holding & and quotes stays inside its attribute", async () => {
    const html = await container.renderToString(BadgeWall, { props: { wall: hostileWall() } });
    const anchor = elementsOf(wallRoot(html).childNodes).find((node) => node.tagName === "a");
    expect(anchor?.attrs).toEqual([
      { name: "href", value: HOSTILE },
      { name: "title", value: HOSTILE },
    ]);
  });

  test("Node.astro hands every attribute value to Astro as a String object", () => {
    const source = readFileSync("astro/Node.astro", "utf8");
    expect(source).toContain("attributes[name] = new String(value);");
    expect(source).not.toMatch(/set:html\s*=/);
  });
});

describe("SubmitatorBadges", () => {
  const API = "http://localhost:3001";
  const FETCHED = "5c6d7e8f-1a2b-4c3d-9e0f-a1b2c3d4e5f6";
  const SLOTS = Symbol.for("submitator.badges.slots.v1");
  const userAgents: Array<string | null> = [];
  let status = 200;

  function envelope(): string {
    const stamp = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");
    const payload = JSON.stringify({
      v: 1,
      project: FETCHED,
      issuedAt: stamp(Date.now() - 60_000),
      expiresAt: stamp(Date.now() + 6 * 86_400_000),
      badges: [selfLink(FETCHED)],
    });
    return JSON.stringify({
      payload,
      signature: signWithTestKey(payload),
      keyId: "test-rfc8032-1",
    });
  }

  beforeEach(() => {
    (globalThis as unknown as Record<symbol, Map<string, unknown> | undefined>)[SLOTS]?.clear();
    userAgents.length = 0;
    status = 200;
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit = {}) => {
      userAgents.push(new Headers(init.headers).get("user-agent"));
      return status === 200
        ? new Response(envelope(), { headers: { "content-type": "application/json" } })
        : new Response(null, { status, headers: { "retry-after": "300" } });
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const props = (extra: Record<string, unknown> = {}) => ({
    project: FETCHED,
    apiUrl: API,
    publicKeys: testKeys(),
    log: false,
    ...extra,
  });

  test("renders the wall it fetched, with layout, class and nonce", async () => {
    const html = await container.renderToString(SubmitatorBadges, {
      props: props({ layout: "row", class: "footer-badges", nonce: "n0nce" }),
    });
    const root = wallRoot(html);
    expect(attr(root, "class")).toBe("sbm-wall sbm-wall-row footer-badges");
    expect(html).toContain('<style nonce="n0nce">');
    expect(html).toContain(`data-sbm-ref="${FETCHED}"`);
  });

  test("names astro in the User-Agent", async () => {
    await container.renderToString(SubmitatorBadges, { props: props() });
    expect(userAgents).toEqual([
      expect.stringMatching(
        /^submitator-badges\/\S+ \(astro; \+https:\/\/submitator\.com\/badge-package\)$/,
      ),
    ]);
  });

  test("an explicit framework wins", async () => {
    await container.renderToString(SubmitatorBadges, { props: props({ framework: "other" }) });
    expect(userAgents[0]).toMatch(/ \(other; \+https:/);
  });

  test("renders nothing when there is no wall", async () => {
    status = 503;
    const html = await container.renderToString(SubmitatorBadges, { props: props() });
    expect(visible(html)).toBe("");
  });
});
