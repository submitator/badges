// One suite for every framework adapter. Each adapter's server HTML must hold
// the same elements as wallToHtml (the canonical renderer) once framework
// noise is set aside (comments such as hydration markers, attribute order),
// and pass the checks directories and our badge checks rely on.
import { parseFragment } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { MockInstance } from "vitest";
import { wallToHtml } from "../../src/html.js";
import { parseWall } from "../../src/parse.js";
import type { Layout, Wall, WallNode, WallRenderOptions } from "../../src/types.js";
import { wallFixtures } from "./fixtures.js";

type Node = DefaultTreeAdapterMap["childNode"];
type Element = DefaultTreeAdapterMap["element"];

export const LAYOUTS: Layout[] = ["marquee", "row"];

/** Every accepted wall of the shared fixtures that has badges, by fixture name. */
export const WALLS: ReadonlyMap<string, Wall> = new Map(
  wallFixtures().flatMap((fixture) => {
    if (!fixture.expect.ok || fixture.expect.ids.length === 0) return [];
    const wall = parseWall(fixture.payload, {
      project: fixture.project,
      now: Date.parse(fixture.now),
    });
    if (wall === null) throw new Error(`${fixture.file} did not parse`);
    return [[fixture.name, wall] as const];
  }),
);

export function wallNamed(name: string): Wall {
  const wall = WALLS.get(name);
  if (wall === undefined) throw new Error(`no accepted fixture wall named ${name}`);
  return wall;
}

/** What an adapter test gives the suite. */
export interface Adapter {
  /** The server HTML of `<BadgeWall wall={wall} {...options} />`, in the adapter's own words. */
  render(wall: Wall | null | undefined, options?: WallRenderOptions): string | Promise<string>;
  /** React keeps one value per style property: the last one, at the place of the last. */
  dedupesStyles?: boolean;
}

export const isElement = (node: Node): node is Element => "tagName" in node;

export function attr(element: Element, name: string): string | undefined {
  return element.attrs.find((entry) => entry.name === name)?.value;
}

export function hasClass(element: Element, name: string): boolean {
  return (attr(element, "class") ?? "").split(/\s+/).includes(name);
}

/** Every element under `nodes`, depth first (template contents included). */
export function elementsOf(nodes: readonly Node[]): Element[] {
  return nodes.filter(isElement).flatMap((element) => [element, ...elementsOf(element.childNodes)]);
}

/** The wall's root element in a piece of server HTML: exactly one is expected. */
export function wallRoot(html: string): Element {
  const roots = elementsOf(parseFragment(html).childNodes).filter(
    (element) => element.tagName === "div" && hasClass(element, "sbm-wall"),
  );
  if (roots.length !== 1) throw new Error(`expected one wall root, found ${roots.length}`);
  return roots[0]!;
}

/** The HTML without comments (hydration markers and the like), trimmed. */
export function visible(html: string): string {
  return html.replace(/<!--[\s\S]*?-->/g, "").trim();
}

/** A style attribute as declarations; values never hold `;` (CONTRACT.md section 6). */
export function declarations(style: string | undefined): Array<[string, string]> {
  if (style === undefined || style === "") return [];
  return style.split(";").map((part) => {
    const colon = part.indexOf(":");
    return [part.slice(0, colon), part.slice(colon + 1)];
  });
}

/** Repeated properties reduced to the last value, at the place of the last. */
export function dedupe(list: Array<[string, string]>): Array<[string, string]> {
  const kept = new Map<string, string>();
  for (const [property, value] of list) {
    kept.delete(property);
    kept.set(property, value);
  }
  return [...kept];
}

interface Shape {
  tag: string;
  attrs: Array<[string, string]>;
  style?: Array<[string, string]>;
  children: Array<Shape | string>;
}

/**
 * An element as plain data: comments dropped, neighbouring text merged,
 * attributes sorted, style as declarations (deduplicated when asked).
 */
export function shape(element: Element, dedupeStyles = false): Shape {
  const attrs = element.attrs
    .filter((entry) => entry.name !== "style")
    .map((entry): [string, string] => [entry.name, entry.value])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const children: Array<Shape | string> = [];
  for (const child of element.childNodes) {
    if (child.nodeName === "#comment") continue;
    if (child.nodeName === "#text") {
      const text = (child as DefaultTreeAdapterMap["textNode"]).value;
      const last = children.length - 1;
      if (typeof children[last] === "string") children[last] += text;
      else children.push(text);
      continue;
    }
    if (isElement(child)) children.push(shape(child, dedupeStyles));
  }
  const style = declarations(attr(element, "style"));
  const result: Shape = { tag: element.tagName, attrs, children };
  if (style.length > 0) result.style = dedupeStyles ? dedupe(style) : style;
  return result;
}

interface Parts {
  root: Element;
  /** The list every visitor sees (the first list in a marquee). */
  list: Element;
  /** The aria-hidden loop copy of a marquee. */
  copy: Element | undefined;
  /** Items of `list` that are not fill. */
  originals: Element[];
  /** Fill items of `list`. */
  fills: Element[];
}

export function partsOf(root: Element): Parts {
  const lists = elementsOf(root.childNodes).filter(
    (element) => element.tagName === "ul" && hasClass(element, "sbm-wall-list"),
  );
  const list = lists.find((element) => !hasClass(element, "sbm-wall-copy"));
  if (list === undefined) throw new Error("the wall has no list");
  const copy = lists.find((element) => hasClass(element, "sbm-wall-copy"));
  const items = list.childNodes.filter(isElement).filter((element) => element.tagName === "li");
  return {
    root,
    list,
    copy,
    originals: items.filter((item) => !hasClass(item, "sbm-wall-fill")),
    fills: items.filter((item) => hasClass(item, "sbm-wall-fill")),
  };
}

const anchorsIn = (nodes: readonly Node[]): Element[] =>
  elementsOf(nodes).filter((element) => element.tagName === "a");

/** The hrefs of a badge tree's anchors, in order. */
function treeHrefs(nodes: readonly WallNode[]): string[] {
  return nodes.flatMap((node) => {
    if (typeof node === "string") return [];
    const own = node.t === "a" && node.a?.["href"] !== undefined ? [node.a["href"]] : [];
    return [...own, ...treeHrefs(node.c ?? [])];
  });
}

const GRAPHICS = new Set(["svg", "path", "circle"]);

/** `[tag, viewBox, stroke-width]` of every svg, path and circle of a badge tree, in order. */
function graphicsOf(nodes: readonly WallNode[]): Array<Array<string | null>> {
  return nodes.flatMap((node) => {
    if (typeof node === "string") return [];
    const own = GRAPHICS.has(node.t)
      ? [[node.t, node.a?.["viewBox"] ?? null, node.a?.["stroke-width"] ?? null]]
      : [];
    return [...own, ...graphicsOf(node.c ?? [])];
  });
}

/** True when `element` sits inside a span.sbm-cb. */
function inCustomWrapper(element: Element): boolean {
  for (let node = element.parentNode; node !== null && "tagName" in node; node = node.parentNode) {
    if (node.tagName === "span" && hasClass(node as Element, "sbm-cb")) return true;
  }
  return false;
}

/**
 * Registers the shared render tests for one adapter. Call it once, at the top
 * level of a test file: it also fails every test of that file that makes the
 * framework print a warning or an error.
 */
export function describeWallRendering(adapter: Adapter): void {
  const dedupeStyles = adapter.dedupesStyles === true;
  const render = async (wall: Wall | null | undefined, options?: WallRenderOptions) =>
    adapter.render(wall, options);
  const retail = wallNamed("hand-retail");
  const three = wallNamed("hand-three-badges");
  const edges = wallNamed("hand-edges");

  // Frameworks report misuse (a wrong attribute name, a bad prop, a hydration
  // mismatch) as console warnings, often once per process: watch every test.
  let errors: MockInstance<typeof console.error>;
  let warnings: MockInstance<typeof console.warn>;
  beforeEach(() => {
    errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    warnings = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    const calls = [...errors.mock.calls, ...warnings.mock.calls];
    errors.mockRestore();
    warnings.mockRestore();
    expect(calls, "framework warnings").toEqual([]);
  });

  test("renders every fixture wall in both layouts, with a class and a nonce", async () => {
    for (const wall of WALLS.values()) {
      for (const layout of LAYOUTS) {
        const html = await render(wall, { layout, className: "x", nonce: "n" });
        expect(attr(wallRoot(html), "data-sbm-wall")).toBeTypeOf("string");
      }
    }
  });

  describe("the same elements as wallToHtml", () => {
    for (const [name, wall] of WALLS) {
      for (const layout of LAYOUTS) {
        test(`${name}, ${layout}`, async () => {
          const html = await render(wall, { layout });
          const expected = wallRoot(wallToHtml(wall, { layout }));
          expect(shape(wallRoot(html), dedupeStyles)).toEqual(shape(expected, dedupeStyles));
        });
      }
    }

    test("with a class and a nonce", async () => {
      const options = { className: "site-footer-badges", nonce: "r4nd0m" };
      const html = await render(three, options);
      const expected = wallRoot(wallToHtml(three, options));
      expect(shape(wallRoot(html), dedupeStyles)).toEqual(shape(expected, dedupeStyles));
    });

    test("for a wall that went through JSON (props, payloads, load data)", async () => {
      const copy = JSON.parse(JSON.stringify(retail)) as Wall;
      const html = await render(copy);
      expect(shape(wallRoot(html), dedupeStyles)).toEqual(
        shape(wallRoot(wallToHtml(retail)), dedupeStyles),
      );
    });
  });

  describe("what directories and our checks read", () => {
    test("the self anchor keeps data-sbm-ref and ?ref=", async () => {
      const { originals } = partsOf(wallRoot(await render(retail)));
      const self = anchorsIn(originals).filter((a) => attr(a, "data-sbm-ref") === retail.project);
      expect(self.map((a) => attr(a, "href"))).toEqual([
        `https://submitator.com?ref=${retail.project}`,
      ]);
    });

    test("the self check of CONTRACT.md section 10 counts the server HTML", async () => {
      const html = await render(retail);
      expect(html).toMatch(new RegExp(`data-sbm-ref="?${retail.project}`));
    });

    test("every directory anchor appears in the list and in the loop copy", async () => {
      const { originals, copy } = partsOf(wallRoot(await render(retail)));
      const expected = retail.badges
        .filter((badge) => badge.kind === "directory")
        .flatMap((badge) => treeHrefs(badge.tree));
      expect(expected.length).toBeGreaterThan(5);
      const hrefs = (nodes: readonly Node[]) => anchorsIn(nodes).map((a) => attr(a, "href"));
      expect(hrefs(originals)).toEqual(expect.arrayContaining(expected));
      expect(hrefs(copy?.childNodes ?? [])).toEqual(expect.arrayContaining(expected));
    });

    test("custom anchors sit only inside span.sbm-cb, directory and self anchors never", async () => {
      const root = wallRoot(await render(retail));
      const custom = new Set(
        retail.badges.filter((b) => b.kind === "custom").flatMap((b) => treeHrefs(b.tree)),
      );
      expect(custom.size).toBe(3);
      const anchors = anchorsIn(root.childNodes);
      const misplaced = anchors.filter(
        (a) => custom.has(attr(a, "href") ?? "") !== inCustomWrapper(a),
      );
      expect(misplaced.map((a) => attr(a, "href"))).toEqual([]);
    });

    test("the loop copy is aria-hidden and its links have tabindex=-1", async () => {
      const { copy } = partsOf(wallRoot(await render(retail)));
      expect(copy && attr(copy, "aria-hidden")).toBe("true");
      const links = anchorsIn(copy?.childNodes ?? []);
      expect(links.length).toBeGreaterThan(10);
      expect(links.filter((a) => attr(a, "tabindex") !== "-1")).toEqual([]);
    });

    test("fill items are aria-hidden with tabindex=-1 links; the originals keep the tab order", async () => {
      const { originals, fills } = partsOf(wallRoot(await render(three)));
      expect(fills.length).toBeGreaterThan(0);
      expect(fills.map((item) => attr(item, "aria-hidden"))).toEqual(fills.map(() => "true"));
      expect(anchorsIn(fills).filter((a) => attr(a, "tabindex") !== "-1")).toEqual([]);
      expect(anchorsIn(originals).filter((a) => attr(a, "tabindex") !== undefined)).toEqual([]);
    });

    test.each([
      ["the self pill", "hand-retail", ["svg", "0 0 24 24", "2.5"]],
      ["a directory icon", "hand-edges", ["path", null, "1"]],
    ])(
      "svg keeps viewBox and stroke-width under their own names (%s)",
      async (_label, name, seen) => {
        const wall = wallNamed(name);
        const html = await render(wall, { layout: "row" });
        const rendered = elementsOf(wallRoot(html).childNodes)
          .filter((element) => GRAPHICS.has(element.tagName))
          .map((element) => [
            element.tagName,
            attr(element, "viewBox") ?? null,
            attr(element, "stroke-width") ?? null,
          ]);
        expect(rendered).toEqual(wall.badges.flatMap((badge) => graphicsOf(badge.tree)));
        expect(rendered).toContainEqual(seen);
        expect(html).not.toMatch(/strokeWidth|strokewidth|viewbox=/);
      },
    );

    test("styles keep their order (and repeats, where the framework can)", async () => {
      const root = wallRoot(await render(edges, { layout: "row" }));
      const styled = elementsOf(root.childNodes).find(
        (element) => attr(element, "aria-label") === "A styled badge",
      );
      const expected: Array<[string, string]> = [
        ["font-family", '"Segoe UI",sans-serif'],
        ["width", "calc(100% - var(--badge-gap, 4px))"],
        ["--badge-accent", "#CCFF00"],
        ["color", "var(--badge-accent)"],
        ["color", "red"],
        ["-webkit-text-size-adjust", "100%"],
        ["quotes", "'(' ')'"],
        ["background", "linear-gradient(90deg, rgba(0,0,0,0.5), transparent)"],
      ];
      expect(declarations(styled && attr(styled, "style"))).toEqual(
        dedupeStyles ? dedupe(expected) : expected,
      );
    });

    test("one style element, holding the package CSS, and no script", async () => {
      const root = wallRoot(await render(three, { nonce: "r4nd0m" }));
      const all = elementsOf(root.childNodes);
      const styles = all.filter((element) => element.tagName === "style");
      expect(styles.map((element) => attr(element, "nonce"))).toEqual(["r4nd0m"]);
      expect(all.filter((element) => element.tagName === "script")).toEqual([]);
    });
  });

  describe("nothing to show", () => {
    test.each([
      ["null", null],
      ["undefined", undefined],
      ["a wall without badges", { ...retail, badges: [] }],
      ["a wall of the wrong version", { ...retail, v: 2 }],
      ["a string", "<script>alert(1)</script>"],
    ])("renders nothing for %s", async (_label, wall) => {
      expect(visible(await render(wall as Wall | null | undefined))).toBe("");
    });
  });
}
