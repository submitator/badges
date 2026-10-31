// Wall contract v1 as the package enforces it. CONTRACT.md is the canon: every
// constant here has its line there, and a change to the shape is /wall/v2.

import { DEFAULT_API_URL } from "./brand.js";
import type { Framework } from "./types.js";

/** The only wall version this package reads. */
export const WALL_VERSION: 1 = 1;

/** Package-side limits. The server is always the stricter side (CONTRACT.md). */
export interface Limits {
  /** Response body cap in bytes, after decompression. */
  readonly bodyBytes: number;
  /** UTF-8 bytes of the signed payload. */
  readonly payloadBytes: number;
  /** Badges per wall (more refuses the wall). */
  readonly badges: number;
  /** Root nodes per badge tree. */
  readonly rootNodes: number;
  /** Nodes (text and elements) per badge. */
  readonly nodesPerBadge: number;
  /** Tree depth per badge; root nodes are depth 1. */
  readonly depth: number;
  /** Characters (code points) per text node. */
  readonly text: number;
  /** Characters per attribute value. */
  readonly attrValue: number;
  /** Characters per `d` attribute value. */
  readonly pathData: number;
  /** Declarations per inline style. */
  readonly styleDecls: number;
  /** Characters per style value. */
  readonly styleValue: number;
  /** Characters per badge name. */
  readonly name: number;
  /** Characters per badge host. */
  readonly host: number;
  /** Longest accepted `expiresAt - issuedAt`, in milliseconds (8 days). */
  readonly wallLifetimeMs: number;
}

export const LIMITS: Limits = Object.freeze({
  bodyBytes: 1_048_576,
  payloadBytes: 524_288,
  badges: 200,
  rootNodes: 16,
  nodesPerBadge: 300,
  depth: 16,
  text: 1000,
  attrValue: 2048,
  pathData: 8192,
  styleDecls: 64,
  styleValue: 1024,
  name: 120,
  host: 253,
  wallLifetimeMs: 8 * 86_400_000,
});

/** The numbers the docs and the landing print. */
export interface Defaults {
  /** Where walls come from unless `apiUrl` says otherwise. */
  readonly apiUrl: string;
  /** Seconds between background refreshes of a wall kept in memory. */
  readonly revalidateSeconds: number;
  /** Milliseconds a render waits, only when no wall is in memory yet. */
  readonly timeoutMs: number;
  /** Days a wall stays valid (the server's `expiresAt - issuedAt`). */
  readonly wallTtlDays: number;
}

export const DEFAULTS: Defaults = Object.freeze({
  apiUrl: DEFAULT_API_URL,
  revalidateSeconds: 60,
  timeoutMs: 2000,
  wallTtlDays: 7,
});

/** Clamps and timings of the client (not part of the wire contract). */
export interface ClientTimings {
  readonly revalidateMinSeconds: number;
  readonly revalidateMaxSeconds: number;
  readonly timeoutMinMs: number;
  readonly timeoutMaxMs: number;
  /** A request is aborted after this long. */
  readonly requestDeadlineMs: number;
  /** A request still pending this long after its deadline is dropped (a frozen instance). */
  readonly stuckGraceMs: number;
  /** The wait after a failed refresh, unless Retry-After asks for another. */
  readonly failureBackoffMs: number;
  /** The longest wait a Retry-After header can ask for. */
  readonly retryAfterMaxMs: number;
  /** Projects kept in memory; the least recently used goes first. */
  readonly maxSlots: number;
  /**
   * How far a wall's issuedAt may run ahead of this server's clock and still
   * keep walls with an older issuedAt out of memory.
   */
  readonly clockSkewMs: number;
}

export const CLIENT: ClientTimings = Object.freeze({
  revalidateMinSeconds: 15,
  revalidateMaxSeconds: 60,
  timeoutMinMs: 100,
  timeoutMaxMs: 10_000,
  requestDeadlineMs: 10_000,
  stuckGraceMs: 5_000,
  failureBackoffMs: 30_000,
  retryAfterMaxMs: 600_000,
  maxSlots: 100,
  clockSkewMs: 600_000,
});

/** Envelope `keyId` (section 3). */
export const KEY_ID_PATTERN: RegExp = /^[a-z0-9][a-z0-9-]{0,31}$/;
/** Envelope `signature`: base64url without padding of 64 bytes. */
export const SIGNATURE_PATTERN: RegExp = /^[A-Za-z0-9_-]{86}$/;
/** A public key: base64url without padding of the raw 32-byte Ed25519 key. */
export const PUBLIC_KEY_PATTERN: RegExp = /^[A-Za-z0-9_-]{43}$/;
/** A project's public id, lowercase. */
export const PROJECT_PATTERN: RegExp =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** `issuedAt` and `expiresAt`: UTC with a Z, up to 6 fraction digits. */
export const TIMESTAMP_PATTERN: RegExp =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?Z$/;

/** Exactly the keys of a wall (section 4). */
export const WALL_KEYS: readonly string[] = Object.freeze([
  "v",
  "project",
  "issuedAt",
  "expiresAt",
  "badges",
]);
/** Exactly the keys of an envelope (section 3). */
export const ENVELOPE_KEYS: readonly string[] = Object.freeze(["payload", "signature", "keyId"]);
/** The keys a badge may carry (section 5). */
export const BADGE_KEYS: readonly string[] = Object.freeze(["kind", "id", "name", "host", "tree"]);
/** The keys an element node may carry (section 6). */
export const ELEMENT_KEYS: readonly string[] = Object.freeze(["t", "a", "s", "c"]);

/** Badge kinds (section 5). */
export const KINDS: readonly string[] = Object.freeze(["self", "directory", "custom"]);
/** Badge `id`; a malformed id is dropped, the badge kept. */
export const BADGE_ID_PATTERN: RegExp = /^(self|[dc]_[0-9a-f-]{36})$/;

/** Element tags (section 6). */
export const TAGS: readonly string[] = Object.freeze(["a", "img", "span", "svg", "path", "circle"]);

/** Attribute names, and only these. There is no class, style, id or event handler. */
export const ATTRIBUTES: readonly string[] = Object.freeze([
  "href",
  "src",
  "alt",
  "title",
  "width",
  "height",
  "loading",
  "target",
  "rel",
  "viewBox",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "d",
  "cx",
  "cy",
  "r",
  "xmlns",
  "data-sbm-ref",
  "data-badge-ref",
  "aria-label",
  "aria-hidden",
]);

/** The one value `xmlns` may have, and only on `svg`. */
export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/** `href` (on `a`) and `src` (on `img`), as sent: never trimmed or normalized. */
export const URL_PATTERN: RegExp = /^https?:\/\/[^\s]/i;

/** Style property names. */
export const STYLE_PROPERTY_PATTERN: RegExp = /^(--[A-Za-z0-9_-]{1,62}|-?[a-z][a-z0-9-]{0,62})$/;
/** Properties refused whatever their value. */
export const STYLE_FORBIDDEN_PROPERTIES: readonly string[] = Object.freeze([
  "behavior",
  "behaviour",
  "-moz-binding",
]);
/** Characters a style value never contains: ; { } < > \ ! and C0 or DEL. */
export const STYLE_FORBIDDEN_CHARACTERS: RegExp = /[;{}<>\\!\x00-\x1f\x7f]/;
/** Functions, at-rules and comments a style value never contains. */
export const STYLE_FORBIDDEN_TOKENS: RegExp =
  /url\s*\(|expression\s*\(|@import|image-set\s*\(|\/\*|\*\//i;

/** The `<framework>` token of the User-Agent (section 1). */
export const FRAMEWORKS: readonly Framework[] = Object.freeze([
  "next",
  "react",
  "nuxt",
  "vue",
  "sveltekit",
  "svelte",
  "astro",
  "node",
  "bun",
  "deno",
  "workerd",
  "edge",
  "other",
]);
/** Every framework token matches this. */
export const FRAMEWORK_PATTERN: RegExp = /^[a-z][a-z0-9-]{0,31}$/;
