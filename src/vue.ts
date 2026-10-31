// Vue adapter. BadgeWall writes the view tree with h(): server rendering
// (Nuxt) and hydration give the same elements, with the style attribute as
// the package's own text (Vue keeps a string style as it is).
//
// Props are declared by name only, so Vue checks no type: null, undefined or
// a malformed wall renders nothing, without a warning. A class given to the
// component goes on the wall's root element; other attributes are dropped.

import { defineComponent, h, normalizeClass } from "vue";
import type { DefineSetupFnComponent, VNode, VNodeChild } from "vue";
import { layoutWall, styleText } from "./layout.js";
import type { Layout, ViewNode, Wall } from "./types.js";

/** Props of BadgeWall. Pass `class` like on any element. */
export interface BadgeWallProps {
  /** The wall from fetchWall. null or undefined renders nothing. */
  wall?: Wall | null | undefined;
  /** `marquee` (the default, from 3 badges up) or `row`. */
  layout?: Layout | undefined;
  /** CSP nonce for the one `<style>` element. */
  nonce?: string | undefined;
}

/** Elements that never have children. */
const VOID_TAGS = new Set(["img"]);

function toVNode(node: ViewNode): VNode {
  const props: Record<string, string> = {};
  for (const [name, value] of node.attrs) props[name] = value;
  if (node.style !== undefined && node.style.length > 0) props["style"] = styleText(node.style);
  if (VOID_TAGS.has(node.tag)) return h(node.tag, props);
  const children: VNodeChild[] = node.children.map((child) =>
    typeof child === "string" ? child : toVNode(child),
  );
  return h(node.tag, props, children);
}

/**
 * Renders a wall: the badges in one scrolling strip (or a still row), with
 * one `<style>` element and no script. Renders nothing for a null, empty or
 * malformed wall, and never throws.
 */
export const BadgeWall: DefineSetupFnComponent<BadgeWallProps> = defineComponent(
  (props: BadgeWallProps, { attrs }) =>
    (): VNode | null => {
      try {
        const view = layoutWall(props.wall, {
          layout: props.layout,
          className: normalizeClass(attrs["class"]),
          nonce: props.nonce,
        });
        return view === null ? null : toVNode(view);
      } catch {
        return null;
      }
    },
  { name: "SubmitatorBadgeWall", inheritAttrs: false, props: ["wall", "layout", "nonce"] },
);
