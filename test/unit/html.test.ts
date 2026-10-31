import { readdirSync } from "node:fs";
import { parseFragment } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";
import { describe, expect, test } from "vitest";
import { CUSTOM_BADGES, EDGE_BADGES, PROJECT, selfLink } from "../../scripts/fixture-cases.mjs";
import { escapeHtml, renderView, wallToHtml } from "../../src/html.js";
import { layoutWall, styleText } from "../../src/layout.js";
import { parseWall } from "../../src/parse.js";
import type { Layout, ViewNode, Wall } from "../../src/types.js";
import { VERSION } from "../../src/version.js";
import { FIXTURES, wallFixtures } from "../support/fixtures.js";

type Node = DefaultTreeAdapterMap["childNode"];
type Element = DefaultTreeAdapterMap["element"];

const LAYOUTS: Layout[] = ["marquee", "row"];

/** Accepted walls that have badges to render, from the shared fixtures. */
const rendered = wallFixtures().flatMap((fixture) => {
  if (!fixture.expect.ok || fixture.expect.ids.length === 0) return [];
  const wall = parseWall(fixture.payload, {
    project: fixture.project,
    now: Date.parse(fixture.now),
  });
  if (wall === null) throw new Error(`${fixture.file} did not parse`);
  return [{ name: fixture.name, wall }];
});

/** The golden files say VERSION where the package version goes, so releases do not change them. */
function golden(html: string): string {
  return `${html.replace(` data-sbm-wall="${VERSION}"`, ' data-sbm-wall="VERSION"')}\n`;
}

function wallOf(badges: unknown[]): Wall {
  const payload = JSON.stringify({
    v: 1,
    project: PROJECT,
    issuedAt: "2026-11-01T00:00:00Z",
    expiresAt: "2026-11-08T00:00:00Z",
    badges,
  });
  return parseWall(payload, { project: PROJECT, now: Date.parse("2026-11-02T00:00:00Z") })!;
}

/** A parsed node in the shape of a view node, so both sides compare. */
function fromParse5(node: Node): ViewNode | string {
  if (node.nodeName === "#text") return (node as DefaultTreeAdapterMap["textNode"]).value;
  const element = node as Element;
  return {
    tag: element.tagName,
    attrs: element.attrs.map(({ name, value }) => [name, value] as const),
    children: element.childNodes.map(fromParse5),
  };
}

/** A view node with its style written as the attribute the HTML carries. */
function asParsed(node: ViewNode | string): ViewNode | string {
  if (typeof node === "string") return node;
  const attrs =
    node.style !== undefined && node.style.length > 0
      ? [...node.attrs, ["style", styleText(node.style)] as const]
      : node.attrs;
  return { tag: node.tag, attrs, children: node.children.map(asParsed) };
}

describe("rendered fixtures", () => {
  test("there is at least one accepted wall to render", () => {
    expect(rendered.map((entry) => entry.name)).toContain("hand-retail");
  });

  test("every file in rendered/ belongs to an accepted wall", () => {
    const expected = rendered.flatMap(({ name }) =>
      LAYOUTS.map((layout) => `${name}.${layout}.html`),
    );
    const files = readdirSync(new URL("rendered/", FIXTURES)).filter((file) =>
      file.endsWith(".html"),
    );
    expect(files.sort()).toEqual(expected.sort());
  });

  for (const { name, wall } of rendered) {
    for (const layout of LAYOUTS) {
      test(`${name}.${layout}.html matches wallToHtml`, async () => {
        await expect(golden(wallToHtml(wall, { layout }))).toMatchFileSnapshot(
          `../fixtures/contract-v1/rendered/${name}.${layout}.html`,
        );
      });

      test(`${name}.${layout}: an HTML parser gives back the same tree`, () => {
        const view = layoutWall(wall, { layout })!;
        const fragment = parseFragment(wallToHtml(wall, { layout }));
        expect(fragment.childNodes).toHaveLength(1);
        expect(fromParse5(fragment.childNodes[0]!)).toEqual(asParsed(view));
      });
    }
  }
});

describe("wallToHtml", () => {
  test("is one line with no whitespace between the package's own elements", () => {
    const html = wallToHtml(wallOf([selfLink(), ...CUSTOM_BADGES]));
    expect(html).not.toContain("\n");
    expect(html).toMatch(
      /^<div class="sbm-wall sbm-wall-marquee" data-sbm-wall="[^"]+" style="--sbm-wall-duration:24s"><style>/,
    );
    expect(html).toContain(
      '</style><div class="sbm-wall-track"><ul class="sbm-wall-list" role="list"><li class="sbm-wall-item">',
    );
  });

  test("escapes text and attribute values", () => {
    const custom = EDGE_BADGES.find((badge) => badge.name?.startsWith("Tom"))!;
    const html = wallToHtml(wallOf([selfLink(), custom]), { layout: "row" });
    expect(html).toContain('title="Tom &amp; Jerry&#39;s &quot;badge&quot; &lt;3"');
    expect(html).toContain(">Tom &amp; Jerry &lt;3 &quot;quoted&quot; &#39;single&#39;</span>");
    expect(html).toContain('style="font-family:&quot;Segoe UI&quot;,sans-serif;');
    expect(html).not.toContain("<3");
  });

  test("escapes the & of URLs and keeps their raw spaces", () => {
    const html = wallToHtml(
      wallOf([selfLink(), ...CUSTOM_BADGES.slice(0, 1), ...EDGE_BADGES.slice(0, 1)]),
    );
    expect(html).toContain(
      'href="https://www.producthunt.com/posts/ai-tool?utm_source=badge-featured&amp;utm_medium=badge"',
    );
    expect(html).toContain('href="HTTPS://Example.com/Upper Case"');
  });

  test("writes path and circle with closing tags, img without one", () => {
    const launchHub = EDGE_BADGES.find((badge) => badge.name === "Launch Hub")!;
    const html = wallToHtml(wallOf([selfLink(), launchHub, ...EDGE_BADGES.slice(0, 1)]), {
      layout: "row",
    });
    expect(html).toMatch(/<circle [^>]*><\/circle>/);
    expect(html).toMatch(/<path [^>]*><\/path>/);
    expect(html).toContain('viewBox="0 0 32 32"');
    expect(html).not.toContain("</img>");
    expect(html).not.toMatch(/\/>/);
  });

  test("writes one style element, no script, and the CSS as is", () => {
    const html = wallToHtml(wallOf([selfLink(), ...CUSTOM_BADGES]), { nonce: "abc" });
    expect(html.match(/<style/g)).toHaveLength(1);
    expect(html).toContain('<style nonce="abc">.sbm-wall{');
    expect(html).not.toContain("<script");
  });

  test("gives the self check one line to count", () => {
    const html = wallToHtml(wallOf([selfLink(), ...CUSTOM_BADGES]));
    const lines = html
      .split("\n")
      .filter((line) => new RegExp(`data-sbm-ref="?${PROJECT}`).test(line));
    expect(lines).toHaveLength(1);
  });

  test.each([
    ["null", null],
    ["undefined", undefined],
    ["a wall without badges", { v: 1, badges: [] }],
    ["garbage", "<script>alert(1)</script>"],
  ])("returns an empty string for %s", (_label, wall) => {
    expect(wallToHtml(wall as Wall | null | undefined)).toBe("");
  });
});

test("escapeHtml escapes & < > and both quotes", () => {
  expect(escapeHtml(`a&b<c>d"e'f`)).toBe("a&amp;b&lt;c&gt;d&quot;e&#39;f");
});

test("renderView writes style text raw and every other text escaped", () => {
  const view: ViewNode = {
    tag: "div",
    attrs: [["class", "x"]],
    children: [
      { tag: "style", attrs: [], children: ["a>b{}"] },
      { tag: "span", attrs: [], children: ["a>b"] },
    ],
  };
  expect(renderView(view)).toBe('<div class="x"><style>a>b{}</style><span>a&gt;b</span></div>');
});
