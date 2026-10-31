// wallToHtml: the wall as an HTML string, for servers without a component
// framework. Every text and attribute value is escaped; the only raw text is
// the package's own stylesheet.

import { layoutWall, styleText } from "./layout.js";
import type { ViewNode, Wall, WallRenderOptions } from "./types.js";

const VOID_TAGS = new Set(["img"]);
const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text and attribute values. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character);
}

/** Serializes a view tree. Text inside `style` (the package's CSS) is written as is. */
export function renderView(node: ViewNode | string, rawText = false): string {
  if (typeof node === "string") return rawText ? node : escapeHtml(node);
  let html = `<${node.tag}`;
  for (const [name, value] of node.attrs) html += ` ${name}="${escapeHtml(value)}"`;
  if (node.style !== undefined && node.style.length > 0) {
    html += ` style="${escapeHtml(styleText(node.style))}"`;
  }
  html += ">";
  if (VOID_TAGS.has(node.tag)) return html;
  for (const child of node.children) html += renderView(child, node.tag === "style");
  return `${html}</${node.tag}>`;
}

/**
 * The wall as one line of HTML to print inside your footer, in the HTML your
 * server sends. "" when there is no wall. Never throws.
 */
export function wallToHtml(wall: Wall | null | undefined, options?: WallRenderOptions): string {
  try {
    const view = layoutWall(wall, options);
    return view === null ? "" : renderView(view);
  } catch {
    return "";
  }
}
