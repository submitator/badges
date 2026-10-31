import { afterEach, describe, expect, test, vi } from "vitest";
import {
  CUSTOM_BADGES,
  DIRECTORY_BADGES,
  EDGE_BADGES,
  PROJECT,
  selfLink,
  selfPill,
} from "../../scripts/fixture-cases.mjs";
import { CSS } from "../../src/css.js";
import { layoutWall, styleText } from "../../src/layout.js";
import { parseWall } from "../../src/parse.js";
import type { ViewNode, Wall } from "../../src/types.js";
import { VERSION } from "../../src/version.js";

const NOW = Date.parse("2026-11-02T00:00:00Z");

function wallOf(badges: unknown[]): Wall {
  const payload = JSON.stringify({
    v: 1,
    project: PROJECT,
    issuedAt: "2026-11-01T00:00:00Z",
    expiresAt: "2026-11-08T00:00:00Z",
    badges,
  });
  const wall = parseWall(payload, { project: PROJECT, now: NOW });
  if (wall === null) throw new Error("the test wall did not parse");
  return wall;
}

const attr = (node: ViewNode, name: string) => node.attrs.find(([key]) => key === name)?.[1];
const isElement = (node: ViewNode | string): node is ViewNode => typeof node !== "string";

/** Every element under `node`, depth first. */
function elements(node: ViewNode): ViewNode[] {
  return [node, ...node.children.filter(isElement).flatMap(elements)];
}

function parts(view: ViewNode | null) {
  if (view === null) throw new Error("no view");
  const [style, body] = view.children.filter(isElement);
  const track = body?.tag === "div" ? body : undefined;
  const lists = track ? track.children.filter(isElement) : [body!];
  return { style: style!, track, list: lists[0]!, copy: lists[1] };
}

const three = () => wallOf([selfPill(), DIRECTORY_BADGES[0], CUSTOM_BADGES[0]]);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("marquee", () => {
  test("originals, fills up to 8, and an aria-hidden loop copy", () => {
    const view = layoutWall(three());
    const { track, list, copy } = parts(view);
    expect(attr(view!, "class")).toBe("sbm-wall sbm-wall-marquee");
    expect(attr(track!, "class")).toBe("sbm-wall-track");
    expect(list.attrs).toEqual([
      ["class", "sbm-wall-list"],
      ["role", "list"],
    ]);
    expect(copy?.attrs).toEqual([
      ["class", "sbm-wall-list sbm-wall-copy"],
      ["aria-hidden", "true"],
    ]);
    const items = list.children.filter(isElement);
    expect(items).toHaveLength(9);
    expect(items.slice(0, 3).map((li) => li.attrs)).toEqual(
      Array.from({ length: 3 }, () => [["class", "sbm-wall-item"]]),
    );
    expect(items.slice(3).map((li) => li.attrs)).toEqual(
      Array.from({ length: 6 }, () => [
        ["class", "sbm-wall-item sbm-wall-fill"],
        ["aria-hidden", "true"],
      ]),
    );
    expect(copy?.children).toHaveLength(9);
  });

  test("the duration is max(20, 3 x the group length) seconds", () => {
    const duration = (badges: unknown[]) =>
      layoutWall(wallOf(badges))?.style?.find(([name]) => name === "--sbm-wall-duration")?.[1];
    expect(duration([selfLink(), ...DIRECTORY_BADGES.slice(0, 2)])).toBe("27s");
    expect(duration([selfLink(), ...DIRECTORY_BADGES.slice(0, 4)])).toBe("30s");
    expect(duration([selfLink(), ...DIRECTORY_BADGES.slice(0, 7)])).toBe("24s");
    expect(duration([selfLink(), ...DIRECTORY_BADGES])).toBe("33s");
  });

  test("8 badges or more need no fill", () => {
    const { list } = parts(layoutWall(wallOf([selfLink(), ...DIRECTORY_BADGES.slice(0, 7)])));
    expect(
      list.children.filter(isElement).every((li) => attr(li, "aria-hidden") === undefined),
    ).toBe(true);
  });

  test("copy and fill links leave the tab order; the originals keep it", () => {
    const { list, copy } = parts(layoutWall(three()));
    const links = (node: ViewNode) => elements(node).filter((element) => element.tag === "a");
    const [originals, fills] = [list.children.slice(0, 3), list.children.slice(3)].map((items) =>
      items.filter(isElement).flatMap(links),
    );
    expect(originals!.every((a) => attr(a, "tabindex") === undefined)).toBe(true);
    expect(fills!.every((a) => attr(a, "tabindex") === "-1")).toBe(true);
    expect(links(copy!).every((a) => attr(a, "tabindex") === "-1")).toBe(true);
    expect(links(copy!)).toHaveLength(9);
  });
});

describe("row", () => {
  test("fewer than 3 badges render as a row", () => {
    for (const badges of [[selfLink()], [selfLink(), DIRECTORY_BADGES[0]]]) {
      const view = layoutWall(wallOf(badges));
      expect(attr(view!, "class")).toBe("sbm-wall sbm-wall-row");
      expect(view?.style?.map(([name]) => name)).not.toContain("--sbm-wall-duration");
      const { list, track } = parts(view);
      expect(track).toBeUndefined();
      expect(list.children).toHaveLength(badges.length);
    }
  });

  test("layout row keeps every badge once, in order, with no copy", () => {
    const wall = wallOf([selfLink(), ...DIRECTORY_BADGES]);
    const { list, copy } = parts(layoutWall(wall, { layout: "row" }));
    expect(copy).toBeUndefined();
    expect(list.children).toHaveLength(wall.badges.length);
  });

  test("an unknown layout falls back to marquee", () => {
    const view = layoutWall(three(), { layout: "grid" as unknown as "row" });
    expect(attr(view!, "class")).toBe("sbm-wall sbm-wall-marquee");
  });
});

describe("what the package adds to badges, and nothing else", () => {
  test("custom trees sit in span.sbm-cb; other kinds never do", () => {
    const wall = wallOf([selfPill(), ...DIRECTORY_BADGES, ...CUSTOM_BADGES]);
    const { list } = parts(layoutWall(wall, { layout: "row" }));
    const items = list.children.filter(isElement);
    items.forEach((li, index) => {
      const badge = wall.badges[index]!;
      const first = li.children[0];
      const wrapped =
        isElement(first!) && first.tag === "span" && attr(first, "class") === "sbm-cb";
      expect(wrapped, `${badge.kind} ${badge.id}`).toBe(badge.kind === "custom");
      if (wrapped) expect(li.children).toHaveLength(1);
    });
  });

  test("loading=lazy only on an img without loading", () => {
    const wall = wallOf([selfLink(), ...DIRECTORY_BADGES, ...EDGE_BADGES]);
    const images = elements(layoutWall(wall, { layout: "row" })!).filter(
      (node) => node.tag === "img",
    );
    expect(images.length).toBeGreaterThan(5);
    for (const img of images) {
      expect(img.attrs.filter(([name]) => name === "loading")).toHaveLength(1);
    }
    const eager = images.find(
      (img) => attr(img, "src") === "https://two-links.example.org/badge.png",
    );
    expect(attr(eager!, "loading")).toBe("eager");
  });

  test("the badge name becomes alt only when alt is missing", () => {
    const wall = wallOf([selfLink(), ...DIRECTORY_BADGES, ...EDGE_BADGES]);
    const images = elements(layoutWall(wall, { layout: "row" })!).filter(
      (node) => node.tag === "img",
    );
    const alt = (src: string) =>
      attr(
        images.find((img) => attr(img, "src") === src)!,
        "alt",
      );
    expect(alt("https://spotstartups.com/badges/spotstartups.com_badge_light.svg")).toBe(
      "Spot Startups",
    );
    expect(alt("https://img.turbo0.com/badge-listed-light.svg")).toBe("Listed on Turbo0");
    expect(alt("HTTP://example.com/badge.svg")).toBe("");
    expect(alt("https://cdn.example.com/logo.png")).toBe("Logo without alt");
    // The lenient badge lost its malformed name, so its img gets no alt.
    expect(alt("https://lenient.example.com/badge.svg")).toBeUndefined();
  });

  test("never changes href, src, rel, target or any attribute the badge has", () => {
    const wall = wallOf([selfPill(), ...DIRECTORY_BADGES, ...CUSTOM_BADGES, ...EDGE_BADGES]);
    const { list } = parts(layoutWall(wall, { layout: "row" }));
    const items = list.children.filter(isElement);
    expect(items).toHaveLength(wall.badges.length);
    items.forEach((li, index) => {
      const badge = wall.badges[index]!;
      const rendered =
        badge.kind === "custom" ? (li.children[0] as ViewNode).children : li.children;
      expect(rendered).toHaveLength(badge.tree.length);
      badge.tree.forEach((node, position) => sameExceptAdditions(node, rendered[position]!));
    });
  });

  test("keeps style declarations in order with duplicates", () => {
    const custom = EDGE_BADGES.find((badge) => badge.name?.startsWith("Tom"))!;
    const wall = wallOf([selfLink(), custom]);
    const span = elements(layoutWall(wall)!).find(
      (node) => attr(node, "aria-label") === "A styled badge",
    );
    expect(span?.style?.filter(([name]) => name === "color")).toEqual([
      ["color", "var(--badge-accent)"],
      ["color", "red"],
    ]);
  });
});

/** The rendered node is the badge node, plus only loading, alt or tabindex at the end. */
function sameExceptAdditions(original: unknown, rendered: ViewNode | string): void {
  if (typeof original === "string") {
    expect(rendered).toBe(original);
    return;
  }
  const node = original as {
    t: string;
    a?: Record<string, string>;
    s?: Array<[string, string]>;
    c?: unknown[];
  };
  const view = rendered as ViewNode;
  expect(view.tag).toBe(node.t);
  const given = Object.entries(node.a ?? {});
  expect(view.attrs.slice(0, given.length)).toEqual(given);
  const added = view.attrs.slice(given.length).map(([name]) => name);
  expect(added.every((name) => ["loading", "alt", "tabindex"].includes(name))).toBe(true);
  expect(view.style ?? []).toEqual(node.s ?? []);
  expect(view.children).toHaveLength((node.c ?? []).length);
  (node.c ?? []).forEach((child, position) => sameExceptAdditions(child, view.children[position]!));
}

describe("the root", () => {
  test("carries data-sbm-wall with the package version and one style element", () => {
    const view = layoutWall(three())!;
    expect(attr(view, "data-sbm-wall")).toBe(VERSION);
    const styles = elements(view).filter((node) => node.tag === "style");
    expect(styles).toHaveLength(1);
    expect(styles[0]?.children).toEqual([CSS]);
    expect(elements(view).some((node) => node.tag === "script")).toBe(false);
  });

  test("className joins the root class; nonce lands on the style element", () => {
    const view = layoutWall(three(), { className: " footer-badges ", nonce: "r4nd0m" })!;
    expect(attr(view, "class")).toBe("sbm-wall sbm-wall-marquee footer-badges");
    expect(parts(view).style.attrs).toEqual([["nonce", "r4nd0m"]]);
    expect(parts(layoutWall(three())).style.attrs).toEqual([]);
  });

  test("the CSS holds no < > & or quote, so every framework writes it as is", () => {
    expect(CSS).not.toMatch(/[<>&"']/);
    expect(CSS.startsWith(".sbm-wall{")).toBe(true);
  });

  // A CSP may block the style element yet allow style attributes, which badges use:
  // `--p:fixed; position:var(--p)` passes every style check, and only containment stops it.
  test.each(["marquee", "row"] as const)(
    "%s: the root's own style attribute keeps every badge inside the strip",
    (layout) => {
      const style = layoutWall(three(), { layout })?.style ?? [];
      expect(style.slice(0, 4)).toEqual([
        ["position", "relative"],
        ["overflow", "hidden"],
        ["contain", "paint"],
        ["isolation", "isolate"],
      ]);
    },
  );
});

describe("the render guard", () => {
  test.each([
    ["null", null],
    ["undefined", undefined],
    ["a wall with no badges", wallOf([])],
    ["a string", "wall"],
    ["an object that is not a wall", { badges: "x" }],
  ])("renders nothing for %s", (_label, value) => {
    expect(layoutWall(value as Wall | null | undefined)).toBeNull();
  });

  test("re-checks a wall that did not come from parseWall", () => {
    const copy = JSON.parse(JSON.stringify(three())) as { badges: Array<{ tree: unknown[] }> };
    copy.badges[1]!.tree = [
      { t: "a", a: { href: "https://x.example", class: "fixed inset-0" }, c: ["x"] },
    ];
    const { list } = parts(layoutWall(copy as unknown as Wall, { layout: "row" }));
    expect(list.children).toHaveLength(2);
    expect(JSON.stringify(list)).not.toContain("inset-0");
  });

  test("never reads the clock", () => {
    const now = vi.spyOn(Date, "now");
    layoutWall(JSON.parse(JSON.stringify(three())) as Wall);
    layoutWall(three());
    expect(now).not.toHaveBeenCalled();
  });
});

test("styleText joins declarations in order", () => {
  expect(
    styleText([
      ["color", "red"],
      ["--x", "1px"],
      ["color", "blue"],
    ]),
  ).toBe("color:red;--x:1px;color:blue");
  expect(styleText([])).toBe("");
});
