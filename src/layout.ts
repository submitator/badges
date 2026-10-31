// Turns a wall into a view tree: plain elements every adapter writes one to
// one (React, Vue, Svelte, Astro, and wallToHtml for any other server).
//
// marquee (from 3 badges): a track of two identical lists; the second is the
// aria-hidden loop copy. Badges repeat as aria-hidden fill items until the
// list holds 8, so the strip never runs out. row: one list that wraps.
//
// What the package adds to a badge tree, and nothing else (CONTRACT.md 8):
// loading="lazy" on an img without loading; the badge name as alt on an img
// with no alt at all; tabindex="-1" on every link that is aria-hidden; the
// span.sbm-cb wrapper around custom badges. Never href, src, rel or target.

import { CLASS, CSS, CUSTOM_BADGE_CLASS } from "./css.js";
import { renderableBadges } from "./parse.js";
import type { ViewNode, Wall, WallBadge, WallNode, WallRenderOptions } from "./types.js";
import { VERSION } from "./version.js";

/** The marquee's numbers. */
export const MARQUEE: {
  /** Fewer badges render as a row. */
  readonly minBadges: number;
  /** Badges repeat as fill items until a list holds this many. */
  readonly groupMin: number;
  /** Seconds of scrolling per item. */
  readonly paceSeconds: number;
  /** The slowest loop, in seconds. */
  readonly minDurationSeconds: number;
} = Object.freeze({ minBadges: 3, groupMin: 8, paceSeconds: 3, minDurationSeconds: 20 });

/** `property:value` pairs joined by `;`, in order, duplicates kept. */
export function styleText(declarations: ReadonlyArray<readonly [string, string]>): string {
  return declarations.map(([property, value]) => `${property}:${value}`).join(";");
}

interface BadgeContext {
  /** The badge's name, for an img without alt. */
  readonly name: string | undefined;
  /** True in the loop copy and in fill items: links leave the tab order. */
  readonly hidden: boolean;
}

function element(
  tag: string,
  attrs: ReadonlyArray<readonly [string, string]>,
  children: ReadonlyArray<ViewNode | string>,
  style?: ReadonlyArray<readonly [string, string]>,
): ViewNode {
  return style !== undefined && style.length > 0
    ? { tag, attrs, style, children }
    : { tag, attrs, children };
}

function viewOf(node: WallNode, context: BadgeContext): ViewNode | string {
  if (typeof node === "string") return node;
  const given = node.a ?? {};
  const attrs: Array<readonly [string, string]> = Object.entries(given);
  if (node.t === "img") {
    if (!Object.hasOwn(given, "loading")) attrs.push(["loading", "lazy"]);
    if (!Object.hasOwn(given, "alt") && context.name !== undefined) {
      attrs.push(["alt", context.name]);
    }
  }
  if (node.t === "a" && context.hidden) attrs.push(["tabindex", "-1"]);
  const children = (node.c ?? []).map((child) => viewOf(child, context));
  return element(node.t, attrs, children, node.s);
}

function item(badge: WallBadge, hidden: boolean, fill: boolean): ViewNode {
  const context: BadgeContext = { name: badge.name, hidden };
  const tree = badge.tree.map((node) => viewOf(node, context));
  const content =
    badge.kind === "custom" ? [element("span", [["class", CUSTOM_BADGE_CLASS]], tree)] : tree;
  const attrs: Array<readonly [string, string]> = fill
    ? [
        ["class", `${CLASS.item} ${CLASS.fill}`],
        ["aria-hidden", "true"],
      ]
    : [["class", CLASS.item]];
  return element("li", attrs, content);
}

/**
 * The view tree of a wall, or null when there is nothing to show (no wall, no
 * badge, or not a wall at all). A wall that did not come from parseWall has
 * every badge checked again. Never throws and never reads the clock.
 */
export function layoutWall(
  wall: Wall | null | undefined,
  options: WallRenderOptions = {},
): ViewNode | null {
  try {
    return layout(wall, options);
  } catch {
    return null;
  }
}

function layout(wall: unknown, options: unknown): ViewNode | null {
  const badges = renderableBadges(wall);
  if (badges === null || badges.length === 0) return null;
  const settings: WallRenderOptions =
    typeof options === "object" && options !== null ? (options as WallRenderOptions) : {};

  const marquee = settings.layout !== "row" && badges.length >= MARQUEE.minBadges;
  const extra = typeof settings.className === "string" ? settings.className.trim() : "";
  const rootClass = [CLASS.root, marquee ? CLASS.marquee : CLASS.row, extra]
    .filter((name) => name !== "")
    .join(" ");
  const rootAttrs: Array<readonly [string, string]> = [
    ["class", rootClass],
    ["data-sbm-wall", VERSION],
  ];
  const nonce = typeof settings.nonce === "string" && settings.nonce !== "" ? settings.nonce : null;
  const style = element("style", nonce === null ? [] : [["nonce", nonce]], [CSS]);

  if (!marquee) {
    const list = element(
      "ul",
      [
        ["class", CLASS.list],
        ["role", "list"],
      ],
      badges.map((badge) => item(badge, false, false)),
    );
    return element("div", rootAttrs, [style, list]);
  }

  const count = badges.length;
  const groupLength = count * Math.ceil(MARQUEE.groupMin / count);
  const group = Array.from({ length: groupLength }, (_, index) => ({
    badge: badges[index % count] as WallBadge,
    fill: index >= count,
  }));
  const list = element(
    "ul",
    [
      ["class", CLASS.list],
      ["role", "list"],
    ],
    group.map(({ badge, fill }) => item(badge, fill, fill)),
  );
  const copy = element(
    "ul",
    [
      ["class", `${CLASS.list} ${CLASS.copy}`],
      ["aria-hidden", "true"],
    ],
    group.map(({ badge, fill }) => item(badge, true, fill)),
  );
  const track = element("div", [["class", CLASS.track]], [list, copy]);
  const duration = Math.max(MARQUEE.minDurationSeconds, groupLength * MARQUEE.paceSeconds);
  return element("div", rootAttrs, [style, track], [["--sbm-wall-duration", `${duration}s`]]);
}
