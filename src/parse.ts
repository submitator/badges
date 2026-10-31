// Wall and badge checks (CONTRACT.md sections 4 to 7).
// - A wall-level failure refuses the whole wall.
// - A badge-level failure skips that badge and keeps the others in order.
// - A malformed id, name or host is dropped and the badge kept.
// Lengths count characters (code points), as the server does.

import {
  ATTRIBUTES,
  BADGE_ID_PATTERN,
  BADGE_KEYS,
  ELEMENT_KEYS,
  KINDS,
  LIMITS,
  PROJECT_PATTERN,
  STYLE_FORBIDDEN_CHARACTERS,
  STYLE_FORBIDDEN_PROPERTIES,
  STYLE_FORBIDDEN_TOKENS,
  STYLE_PROPERTY_PATTERN,
  SVG_NAMESPACE,
  TAGS,
  TIMESTAMP_PATTERN,
  URL_PATTERN,
  WALL_KEYS,
  WALL_VERSION,
} from "./contract.js";
import type { BadgeKind, Wall, WallBadge, WallElement, WallNode, WallTag } from "./types.js";

/** Why a whole wall was refused. */
export type WallReason =
  "payload" | "version" | "project" | "timestamps" | "lifetime" | "expired" | "limits";

/** Why one badge was skipped. */
export type SkipReason =
  | "badge"
  | "kind"
  | "tree"
  | "node"
  | "tag"
  | "attribute"
  | "url"
  | "style"
  | "structure"
  | "text"
  | "limits";

/** A badge left out of a wall: its position in the payload and why. */
export interface Skip {
  readonly index: number;
  readonly reason: SkipReason;
  readonly detail: string;
}

export type ParseResult =
  | {
      readonly ok: true;
      readonly wall: Wall;
      /** `expiresAt` in milliseconds, rounded up. */
      readonly expiresAtMs: number;
      readonly skips: readonly Skip[];
    }
  | { readonly ok: false; readonly reason: WallReason; readonly detail: string };

export type BadgeCheck =
  | { readonly ok: true; readonly badge: WallBadge }
  | { readonly ok: false; readonly reason: SkipReason; readonly detail: string };

export interface ParseOptions {
  /** The project the wall was requested for. */
  project: string;
  /** The current time in milliseconds. Default `Date.now()`. */
  now?: number | undefined;
}

const KIND_SET = new Set(KINDS);
const BADGE_KEY_SET = new Set(BADGE_KEYS);
const ELEMENT_KEY_SET = new Set(ELEMENT_KEYS);
const TAG_SET = new Set(TAGS);
const ATTRIBUTE_SET = new Set(ATTRIBUTES);
const FORBIDDEN_PROPERTY_SET = new Set(STYLE_FORBIDDEN_PROPERTIES);

/** C0 controls other than TAB, LF and CR, and DEL: refused in text and attribute values. */
const TEXT_CONTROL = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/;
/** Any C0 control or DEL: refused in URLs and names. */
const ANY_CONTROL = /[\x00-\x1f\x7f]/;
/** What a host never contains: whitespace, controls, `/`, `?` or `#`. */
const HOST_FORBIDDEN = /[\s\x00-\x1f\x7f-\x9f/?#]/;
const LIFETIME_MICROS = BigInt(LIMITS.wallLifetimeMs) * 1000n;

/** Walls produced here: frozen, checked, and trusted by the renderers. */
const parsedWalls = new WeakSet<object>();
/** Badges re-checked for walls that did not come from parseWall (props, payloads). */
const recheckedWalls = new WeakMap<object, readonly WallBadge[] | null>();

class Refusal {
  readonly reason: SkipReason;
  readonly detail: string;
  constructor(reason: SkipReason, detail: string) {
    this.reason = reason;
    this.detail = detail;
  }
}

function refuse(reason: SkipReason, detail: string): never {
  throw new Refusal(reason, detail);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** True when `value` has at most `max` characters (code points). */
function withinLength(value: string, max: number): boolean {
  if (value.length <= max) return true;
  if (value.length > max * 2) return false;
  let count = 0;
  for (const _ of value) {
    count += 1;
    if (count > max) return false;
  }
  return true;
}

/** Shortens a value for a log line. */
function clip(value: string): string {
  return value.length > 40 ? `${value.slice(0, 40)}...` : value;
}

/** Lowercases and checks a project id; null when it is not a UUID. */
export function normalizeProject(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const project = value.trim().toLowerCase();
  return PROJECT_PATTERN.test(project) ? project : null;
}

function daysInMonth(year: number, month: number): number {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

/** A contract timestamp in microseconds since the epoch, or null when malformed. */
export function timestampMicros(value: string): bigint | null {
  const match = TIMESTAMP_PATTERN.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    second === undefined
  ) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  const fraction = (match[7] ?? "").padEnd(6, "0");
  return BigInt(date.getTime()) * 1000n + BigInt(fraction);
}

function balanced(value: string): boolean {
  let quote: string | null = null;
  let depth = 0;
  for (const character of value) {
    if (quote !== null) {
      if (character === quote) quote = null;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  return quote === null && depth === 0;
}

function readStyle(value: unknown): ReadonlyArray<readonly [string, string]> | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) refuse("style", "s must be an array");
  if (value.length > LIMITS.styleDecls) refuse("limits", "more than 64 style declarations");
  const declarations: Array<readonly [string, string]> = [];
  for (const declaration of value) {
    if (
      !Array.isArray(declaration) ||
      declaration.length !== 2 ||
      typeof declaration[0] !== "string" ||
      typeof declaration[1] !== "string"
    ) {
      refuse("style", "a style declaration must be a [property, value] pair of strings");
    }
    const property: string = declaration[0];
    if (!STYLE_PROPERTY_PATTERN.test(property)) {
      refuse("style", `style property "${clip(property)}" is malformed`);
    }
    if (FORBIDDEN_PROPERTY_SET.has(property))
      refuse("style", `style property ${property} is refused`);
    // Values come trimmed; surrounding spaces are dropped, never refused.
    const text: string = declaration[1].replace(/^ +| +$/g, "");
    if (text.length === 0) refuse("style", `${property} has an empty value`);
    if (!withinLength(text, LIMITS.styleValue))
      refuse("limits", `${property} is over 1024 characters`);
    if (STYLE_FORBIDDEN_CHARACTERS.test(text)) {
      refuse("style", `${property} has one of ; { } < > \\ ! or a control character`);
    }
    if (STYLE_FORBIDDEN_TOKENS.test(text)) {
      refuse("style", `${property} has url(, expression(, @import, image-set( or a comment`);
    }
    if (!balanced(text)) refuse("style", `${property} has unbalanced quotes or parentheses`);
    if (property === "position" && /fixed/i.test(text))
      refuse("style", "position fixed is refused");
    declarations.push(Object.freeze([property, text] as const));
  }
  return declarations.length > 0 ? Object.freeze(declarations) : null;
}

function readAttributes(tag: WallTag, value: unknown): Readonly<Record<string, string>> | null {
  if (value === undefined) return null;
  if (!isObject(value)) refuse("attribute", "a must be an object");
  const entries: Array<[string, string]> = [];
  for (const name of Object.keys(value)) {
    if (!ATTRIBUTE_SET.has(name)) refuse("attribute", `attribute "${clip(name)}" is not allowed`);
    const text = value[name];
    if (typeof text !== "string") refuse("attribute", `${name} must be a string`);
    const max = name === "d" ? LIMITS.pathData : LIMITS.attrValue;
    if (!withinLength(text, max)) refuse("limits", `${name} is over ${max} characters`);
    if (TEXT_CONTROL.test(text)) refuse("attribute", `${name} has a control character`);
    if (name === "href" || name === "src") {
      const home: WallTag = name === "href" ? "a" : "img";
      if (tag !== home) refuse("attribute", `${name} is allowed only on ${home}`);
      if (!URL_PATTERN.test(text) || ANY_CONTROL.test(text)) {
        refuse("url", `${name} must start with http:// or https://`);
      }
    }
    if (name === "xmlns" && (tag !== "svg" || text !== SVG_NAMESPACE)) {
      refuse("attribute", "xmlns is allowed only on svg, with the SVG namespace");
    }
    entries.push([name, text]);
  }
  return entries.length > 0 ? Object.freeze(Object.fromEntries(entries)) : null;
}

interface TreeState {
  nodes: number;
}

function readNode(
  node: unknown,
  parent: WallTag | null,
  depth: number,
  insideLink: boolean,
  state: TreeState,
): WallNode {
  if (depth > LIMITS.depth) refuse("limits", "the tree is deeper than 16 levels");
  state.nodes += 1;
  if (state.nodes > LIMITS.nodesPerBadge) refuse("limits", "the tree has more than 300 nodes");

  if (typeof node === "string") {
    if (parent === "svg") refuse("structure", "text inside svg");
    if (node.length === 0) refuse("text", "empty text node");
    if (!withinLength(node, LIMITS.text)) refuse("limits", "text over 1000 characters");
    if (TEXT_CONTROL.test(node)) refuse("text", "text has a control character");
    return node;
  }

  if (!isObject(node)) refuse("node", "a node must be a string or an object");
  for (const key of Object.keys(node)) {
    if (!ELEMENT_KEY_SET.has(key)) refuse("node", `unknown node field "${clip(key)}"`);
  }
  const t = node["t"];
  if (typeof t !== "string" || !TAG_SET.has(t)) {
    refuse("tag", `tag ${typeof t === "string" ? `"${clip(t)}"` : "missing"} is not allowed`);
  }
  const tag = t as WallTag;
  if ((tag === "path" || tag === "circle") && parent !== "svg") {
    refuse("structure", `${tag} outside svg`);
  }
  if (parent === "svg" && tag !== "path" && tag !== "circle") {
    refuse("structure", `${tag} inside svg`);
  }
  if (tag === "a" && insideLink) refuse("structure", "a inside a");

  const attributes = readAttributes(tag, node["a"]);
  const style = readStyle(node["s"]);

  const rawChildren = node["c"];
  const children: WallNode[] = [];
  if (rawChildren !== undefined) {
    if (!Array.isArray(rawChildren)) refuse("node", "c must be an array");
    if (rawChildren.length > 0 && (tag === "img" || tag === "path" || tag === "circle")) {
      refuse("structure", `${tag} cannot have children`);
    }
    for (const child of rawChildren) {
      children.push(readNode(child, tag, depth + 1, insideLink || tag === "a", state));
    }
  }

  const element: {
    t: WallTag;
    a?: Readonly<Record<string, string>>;
    s?: ReadonlyArray<readonly [string, string]>;
    c?: ReadonlyArray<WallNode>;
  } = { t: tag };
  if (attributes !== null) element.a = attributes;
  if (style !== null) element.s = style;
  if (children.length > 0) element.c = Object.freeze(children);
  return Object.freeze(element) as WallElement;
}

function readBadge(value: unknown): WallBadge {
  if (!isObject(value)) refuse("badge", "a badge must be an object");
  for (const key of Object.keys(value)) {
    if (!BADGE_KEY_SET.has(key)) refuse("badge", `unknown badge field "${clip(key)}"`);
  }
  const kind = value["kind"];
  if (typeof kind !== "string" || !KIND_SET.has(kind)) {
    refuse("kind", "kind must be self, directory or custom");
  }
  const tree = value["tree"];
  if (!Array.isArray(tree) || tree.length === 0) refuse("tree", "tree must be a non-empty array");
  if (tree.length > LIMITS.rootNodes) refuse("limits", "the tree has more than 16 root nodes");

  const state: TreeState = { nodes: 0 };
  const nodes: WallNode[] = [];
  for (const node of tree) nodes.push(readNode(node, null, 1, false, state));

  const badge: {
    kind: BadgeKind;
    id?: string;
    name?: string;
    host?: string;
    tree?: ReadonlyArray<WallNode>;
  } = { kind: kind as BadgeKind };
  const { id, name, host } = value;
  if (typeof id === "string" && BADGE_ID_PATTERN.test(id)) badge.id = id;
  if (
    typeof name === "string" &&
    name.length > 0 &&
    withinLength(name, LIMITS.name) &&
    !ANY_CONTROL.test(name)
  ) {
    badge.name = name;
  }
  if (
    typeof host === "string" &&
    host.length > 0 &&
    withinLength(host, LIMITS.host) &&
    !HOST_FORBIDDEN.test(host)
  ) {
    badge.host = host;
  }
  badge.tree = Object.freeze(nodes);
  return Object.freeze(badge) as WallBadge;
}

/**
 * Checks one badge against sections 5 and 6. On success the badge is a frozen
 * copy with malformed id, name or host dropped. Never throws.
 */
export function checkBadge(value: unknown): BadgeCheck {
  try {
    return { ok: true, badge: readBadge(value) };
  } catch (error) {
    if (error instanceof Refusal) return { ok: false, reason: error.reason, detail: error.detail };
    return { ok: false, reason: "badge", detail: "the badge could not be read" };
  }
}

function fail(reason: WallReason, detail: string): ParseResult {
  return { ok: false, reason, detail };
}

/** Parses and checks a wall payload. Never throws. */
export function parseWallDetailed(payload: string, options: ParseOptions): ParseResult {
  const project = normalizeProject(options.project);
  if (project === null) return fail("project", "the requested project is not a UUID");

  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    return fail("payload", "the payload is not JSON");
  }
  if (!isObject(data)) return fail("payload", "the payload is not a JSON object");
  const keys = Object.keys(data);
  if (keys.length !== WALL_KEYS.length || !WALL_KEYS.every((key) => keys.includes(key))) {
    return fail("payload", "the payload must have exactly v, project, issuedAt, expiresAt, badges");
  }
  const { v, issuedAt, expiresAt, badges } = data;
  const wallProject = data["project"];
  if (
    typeof wallProject !== "string" ||
    typeof issuedAt !== "string" ||
    typeof expiresAt !== "string" ||
    !Array.isArray(badges)
  ) {
    return fail("payload", "project, issuedAt and expiresAt must be strings, badges an array");
  }
  if (v !== WALL_VERSION) return fail("version", "v is not 1");
  if (wallProject !== project) return fail("project", "the wall is for another project");

  const issued = timestampMicros(issuedAt);
  const expires = timestampMicros(expiresAt);
  if (issued === null || expires === null) {
    return fail("timestamps", "issuedAt or expiresAt is not a UTC timestamp");
  }
  if (issued >= expires) return fail("timestamps", "issuedAt is not before expiresAt");
  if (expires - issued > LIFETIME_MICROS) return fail("lifetime", "the wall lives over 8 days");
  const now = options.now !== undefined && Number.isFinite(options.now) ? options.now : Date.now();
  if (BigInt(Math.floor(now)) * 1000n >= expires) return fail("expired", "the wall has expired");
  if (badges.length > LIMITS.badges) return fail("limits", "the wall has more than 200 badges");

  const kept: WallBadge[] = [];
  const skips: Skip[] = [];
  for (let index = 0; index < badges.length; index += 1) {
    const result = checkBadge(badges[index]);
    if (result.ok) kept.push(result.badge);
    else skips.push(Object.freeze({ index, reason: result.reason, detail: result.detail }));
  }

  const wall: Wall = Object.freeze({
    v: WALL_VERSION,
    project,
    issuedAt,
    expiresAt,
    badges: Object.freeze(kept),
    skipped: skips.length,
  });
  parsedWalls.add(wall);
  return {
    ok: true,
    wall,
    expiresAtMs: Number((expires + 999n) / 1000n),
    skips: Object.freeze(skips),
  };
}

/**
 * Parses and checks a wall payload (the signed text) for `options.project`.
 * Returns the wall, with failing badges left out, or null when the wall itself
 * fails. Never throws.
 */
export function parseWall(payload: string, options: ParseOptions): Wall | null {
  const result = parseWallDetailed(payload, options);
  return result.ok ? result.wall : null;
}

/** True for a wall that came out of parseWall in this copy of the package. */
export function isParsedWall(value: unknown): boolean {
  return typeof value === "object" && value !== null && parsedWalls.has(value);
}

/**
 * The badges a renderer may draw. A wall from parseWall is trusted as is; any
 * other object (a wall that went through JSON on its way to a component) has
 * every badge checked again, once per object. Null when there is no wall to
 * draw. Never throws and never reads the clock.
 */
export function renderableBadges(wall: unknown): readonly WallBadge[] | null {
  if (typeof wall !== "object" || wall === null) return null;
  if (parsedWalls.has(wall)) return (wall as Wall).badges;
  const cached = recheckedWalls.get(wall);
  if (cached !== undefined) return cached;
  let badges: readonly WallBadge[] | null = null;
  try {
    const record = wall as Record<string, unknown>;
    const list = record["badges"];
    if (record["v"] === WALL_VERSION && Array.isArray(list) && list.length <= LIMITS.badges) {
      const kept: WallBadge[] = [];
      for (const value of list) {
        const result = checkBadge(value);
        if (result.ok) kept.push(result.badge);
      }
      badges = Object.freeze(kept);
    }
  } catch {
    badges = null;
  }
  recheckedWalls.set(wall, badges);
  return badges;
}
