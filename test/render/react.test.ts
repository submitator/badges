// Runs twice: in the "react" project (React 19) and in "react18", where
// vitest.config.ts points react and react-dom at React 18.3, the oldest React
// the package supports.
import { createElement, version } from "react";
import * as server from "react-dom/server";
import { afterEach, beforeEach, describe, expect, inject, test, vi } from "vitest";
import { EXPIRES_AT, ISSUED_AT, NOW, PROJECT, selfLink } from "../../scripts/fixture-cases.mjs";
import { signWithTestKey } from "../../scripts/write-fixtures.mjs";
import { parseWall } from "../../src/parse.js";
import { BadgeWall, SubmitatorBadges } from "../../src/react.js";
import type { SubmitatorBadgesProps } from "../../src/react.js";
import { testKeys } from "../support/fixtures.js";
import { attr, describeWallRendering, elementsOf, visible, wallRoot } from "../support/render.js";

declare module "vitest" {
  export interface ProvidedContext {
    reactMajor: number;
  }
}

const major = inject("reactMajor");

test(`runs on React ${major}`, () => {
  expect(version.split(".")[0]).toBe(String(major));
});

describeWallRendering({
  render: (wall, options = {}) =>
    server.renderToString(createElement(BadgeWall, { wall, ...options })),
  dedupesStyles: true,
});

describe("inline styles", () => {
  /** The style attribute React writes for a span with these declarations. */
  function styleOf(declarations: Array<[string, string]>): string | undefined {
    const payload = JSON.stringify({
      v: 1,
      project: PROJECT,
      issuedAt: ISSUED_AT,
      expiresAt: EXPIRES_AT,
      badges: [selfLink(), { kind: "directory", tree: [{ t: "span", s: declarations, c: ["x"] }] }],
    });
    const wall = parseWall(payload, { project: PROJECT, now: Date.parse(NOW) });
    const html = server.renderToString(createElement(BadgeWall, { wall, layout: "row" }));
    const span = elementsOf(wallRoot(html).childNodes).find(
      (element) => element.tagName === "span",
    );
    return span && attr(span, "style");
  }

  test("vendor prefixes and custom properties come back in their CSS spelling", () => {
    expect(
      styleOf([
        ["-webkit-text-size-adjust", "100%"],
        ["-moz-osx-font-smoothing", "grayscale"],
        ["-ms-transform", "none"],
        ["--Mixed_Case-1", "1"],
        ["text-decoration", "none"],
      ]),
    ).toBe(
      "-webkit-text-size-adjust:100%;-moz-osx-font-smoothing:grayscale;-ms-transform:none;--Mixed_Case-1:1;text-decoration:none",
    );
  });

  test("a repeated property keeps its last value, at the place of the last", () => {
    expect(
      styleOf([
        ["color", "blue"],
        ["display", "block"],
        ["color", "red"],
      ]),
    ).toBe("display:block;color:red");
  });
});

describe("SubmitatorBadges", () => {
  const API = "http://localhost:3001";
  const FETCHED = "3f1b6c2a-9d4e-4f70-8a15-6b2c7d9e0f11";
  const SLOTS = Symbol.for("submitator.badges.slots.v1");
  const requests: Array<{ url: string; userAgent: string | null; revalidate: unknown }> = [];
  let status = 200;

  function envelope(): string {
    const payload = JSON.stringify({
      v: 1,
      project: FETCHED,
      issuedAt: new Date(Date.now() - 60_000).toISOString().replace(/\.\d+Z$/, "Z"),
      expiresAt: new Date(Date.now() + 6 * 86_400_000).toISOString().replace(/\.\d+Z$/, "Z"),
      badges: [selfLink(FETCHED)],
    });
    return JSON.stringify({
      payload,
      signature: signWithTestKey(payload),
      keyId: "test-rfc8032-1",
    });
  }

  function stubFetch(next = false) {
    const fake = Object.assign(
      async (url: string, init: RequestInit & { next?: { revalidate?: unknown } } = {}) => {
        const headers = new Headers(init.headers);
        requests.push({
          url,
          userAgent: headers.get("user-agent"),
          revalidate: init.next?.revalidate,
        });
        if (url.startsWith("data:")) return new Response("submitator-wall");
        return status === 200
          ? new Response(envelope(), { headers: { "content-type": "application/json" } })
          : new Response(null, { status, headers: { "retry-after": "300" } });
      },
      next ? { __nextPatched: true } : {},
    );
    vi.stubGlobal("fetch", fake);
  }

  const props = (extra: Partial<SubmitatorBadgesProps> = {}): SubmitatorBadgesProps => ({
    project: FETCHED,
    apiUrl: API,
    publicKeys: testKeys(),
    log: false,
    ...extra,
  });

  beforeEach(() => {
    (globalThis as unknown as Record<symbol, Map<string, unknown> | undefined>)[SLOTS]?.clear();
    requests.length = 0;
    status = 200;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("renders the wall it fetched, with layout, class and nonce", async () => {
    stubFetch();
    const element = await SubmitatorBadges(
      props({ layout: "row", className: "footer-badges", nonce: "n0nce" }),
    );
    const root = wallRoot(server.renderToString(element!));
    expect(attr(root, "class")).toBe("sbm-wall sbm-wall-row footer-badges");
    expect(server.renderToString(element!)).toContain(`<style nonce="n0nce">`);
    expect(server.renderToString(element!)).toContain(`data-sbm-ref="${FETCHED}"`);
  });

  test("names react in the User-Agent outside Next.js", async () => {
    stubFetch();
    await SubmitatorBadges(props());
    expect(requests.map((request) => request.userAgent)).toEqual([
      expect.stringMatching(
        /^submitator-badges\/\S+ \(react; \+https:\/\/submitator\.com\/badge-package\)$/,
      ),
    ]);
  });

  test("names next in the User-Agent under Next.js, and marks the page lifetime", async () => {
    stubFetch(true);
    await SubmitatorBadges(props());
    expect(requests.map((request) => [request.url.split(":")[0], request.revalidate])).toEqual([
      ["data", 60],
      ["http", 60],
    ]);
    expect(requests[1]?.userAgent).toMatch(/ \(next; \+https:/);
  });

  test("an explicit framework wins", async () => {
    stubFetch(true);
    await SubmitatorBadges(props({ framework: "other" }));
    expect(requests.find((request) => request.url.startsWith("http"))?.userAgent).toMatch(
      / \(other; \+https:/,
    );
  });

  test("renders nothing when there is no wall", async () => {
    status = 503;
    stubFetch();
    expect(await SubmitatorBadges(props())).toBeNull();
  });

  test("renders nothing for an invalid project, without fetching", async () => {
    stubFetch();
    expect(await SubmitatorBadges(props({ project: "not-a-uuid" }))).toBeNull();
    expect(requests).toEqual([]);
  });

  test.runIf(major >= 19)("renders as an async component in React's server renderer", async () => {
    stubFetch();
    const stream = await server.renderToReadableStream(createElement(SubmitatorBadges, props()));
    const html = await new Response(stream).text();
    expect(visible(html)).toContain(`data-sbm-ref="${FETCHED}"`);
  });
});
