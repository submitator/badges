// React adapter. BadgeWall writes the view tree with createElement only: no
// JSX, no hooks and no "use client", so the same component renders in Server
// Components, in server rendering (React 18.3 and 19) and on the client
// (Pages Router hydration). SubmitatorBadges is an async Server Component:
// it fetches the wall on the server and renders BadgeWall, or nothing.

import { createElement } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { fetchWall } from "./client.js";
import { layoutWall } from "./layout.js";
import { isNext } from "./runtime.js";
import type { FetchWallOptions, ViewNode, Wall, WallRenderOptions } from "./types.js";

/** Props of BadgeWall. */
export interface BadgeWallProps extends WallRenderOptions {
  /** The wall from fetchWall. null or undefined renders nothing. */
  wall: Wall | null | undefined;
}

/** Props of SubmitatorBadges: the options of fetchWall and of every renderer. */
export interface SubmitatorBadgesProps extends FetchWallOptions, WallRenderOptions {}

/** Attribute names React spells differently. Every other name passes as it is. */
const REACT_NAMES: ReadonlyMap<string, string> = new Map([
  ["class", "className"],
  ["tabindex", "tabIndex"],
  ["stroke-width", "strokeWidth"],
  ["stroke-linecap", "strokeLinecap"],
  ["stroke-linejoin", "strokeLinejoin"],
]);

/**
 * A CSS property as a key of React's style object: custom properties keep
 * their name, `-ms-x` becomes `msX`, `-webkit-x` becomes `WebkitX` and any
 * other name is camelCased. React writes each key back in its CSS spelling.
 */
function styleKey(property: string): string {
  if (property.startsWith("--")) return property;
  const name = property.startsWith("-ms-") ? property.slice(1) : property;
  return name.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

/**
 * Declarations as a React style object. An object keeps one value per
 * property, so a repeated property keeps its last value, moved to the place of
 * its last declaration: shorthand and longhand overrides keep their meaning.
 */
function styleObject(declarations: ReadonlyArray<readonly [string, string]>): CSSProperties {
  const style: Record<string, string> = {};
  for (const [property, value] of declarations) {
    const key = styleKey(property);
    delete style[key];
    style[key] = value;
  }
  return style as CSSProperties;
}

function propsOf(node: ViewNode): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const [name, value] of node.attrs) props[REACT_NAMES.get(name) ?? name] = value;
  if (node.style !== undefined && node.style.length > 0) props["style"] = styleObject(node.style);
  return props;
}

/** Children go in as arguments, not as an array, so React needs no keys. */
function toReact(node: ViewNode | string): ReactNode {
  if (typeof node === "string") return node;
  return createElement(node.tag, propsOf(node), ...node.children.map(toReact));
}

/**
 * Renders a wall: the badges in one scrolling strip (or a still row), with
 * one `<style>` element and no script. Renders nothing for a null, empty or
 * malformed wall, and never throws.
 */
export function BadgeWall(props: BadgeWallProps): ReactElement | null {
  try {
    const { wall, layout, className, nonce } = props;
    const view = layoutWall(wall, { layout, className, nonce });
    return view === null ? null : (toReact(view) as ReactElement);
  } catch {
    return null;
  }
}

/**
 * Fetches your project's wall on the server and renders it: an async Server
 * Component (Next.js App Router). Renders nothing when there is no wall to
 * show, and never throws.
 */
export async function SubmitatorBadges(props: SubmitatorBadgesProps): Promise<ReactElement | null> {
  try {
    const { layout, className, nonce, ...options } = props;
    const wall = await fetchWall({
      ...options,
      framework: options.framework ?? (isNext() ? "next" : "react"),
    });
    return wall === null ? null : createElement(BadgeWall, { wall, layout, className, nonce });
  } catch {
    return null;
  }
}
