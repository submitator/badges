// The core of @submitator/badges. Framework adapters live in /react, /vue,
// /svelte and /astro; every one of them renders what layoutWall returns.

export { DEFAULT_API_URL } from "./brand.js";
export { fetchWall } from "./client.js";
export { DEFAULTS, LIMITS, WALL_VERSION } from "./contract.js";
export type { Defaults, Limits } from "./contract.js";
export { CSS } from "./css.js";
export { wallToHtml } from "./html.js";
export { PUBLIC_KEYS } from "./keys.js";
export { layoutWall, styleText } from "./layout.js";
export { parseWall } from "./parse.js";
export type { ParseOptions } from "./parse.js";
export { verifyEnvelope } from "./verify.js";
export { VERSION } from "./version.js";
export type {
  BadgeKind,
  FetchWallOptions,
  Framework,
  Layout,
  ViewNode,
  Wall,
  WallBadge,
  WallElement,
  WallNode,
  WallRenderOptions,
  WallTag,
} from "./types.js";
