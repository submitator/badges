// Public types. A Wall is plain JSON (no undefined, Date or Map), so it passes
// through Next.js props, the Nuxt payload and SvelteKit's load data unchanged.

/** What a badge is: our own badge, a directory's badge, or one the customer added. */
export type BadgeKind = "self" | "directory" | "custom";

/** The tags a badge tree can hold. */
export type WallTag = "a" | "img" | "span" | "svg" | "path" | "circle";

/** A node of a badge tree: a text string or an element. */
export type WallNode = string | WallElement;

/** An element of a badge tree. */
export interface WallElement {
  /** The tag. */
  readonly t: WallTag;
  /** Attributes in source order, from the contract's allowlist. */
  readonly a?: Readonly<Record<string, string>>;
  /** Inline style as `[property, value]` pairs, in source order, duplicates kept. */
  readonly s?: ReadonlyArray<readonly [string, string]>;
  /** Children. */
  readonly c?: ReadonlyArray<WallNode>;
}

/** One badge of a wall. */
export interface WallBadge {
  readonly kind: BadgeKind;
  /** `self`, `d_<directory id>` or `c_<custom badge id>`; absent when malformed. */
  readonly id?: string;
  /** The directory's or the customer's name for the badge. */
  readonly name?: string;
  /** The normalized host of the badge's first link. */
  readonly host?: string;
  /** The badge itself: 1 to 16 root nodes. */
  readonly tree: ReadonlyArray<WallNode>;
}

/** A checked wall: what `fetchWall` returns and every renderer takes. */
export interface Wall {
  readonly v: 1;
  /** The project's public id, lowercase. */
  readonly project: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  /** The badges that passed every check, in the server's order. */
  readonly badges: ReadonlyArray<WallBadge>;
  /** How many badges were left out because they failed a check. */
  readonly skipped: number;
}

/** The `<framework>` token of the User-Agent. */
export type Framework =
  | "next"
  | "react"
  | "nuxt"
  | "vue"
  | "sveltekit"
  | "svelte"
  | "astro"
  | "node"
  | "bun"
  | "deno"
  | "workerd"
  | "edge"
  | "other";

/** Options of `fetchWall`. */
export interface FetchWallOptions {
  /** Your project's public id (a UUID). Required. */
  project: string;
  /** Where walls come from. Default `https://api.submitator.com`. */
  apiUrl?: string | undefined;
  /** Seconds between background refreshes, 15 to 60. Default 60. */
  revalidate?: number | undefined;
  /** Milliseconds to wait for a wall, only when none is in memory yet. 100 to 10000, default 2000. */
  timeout?: number | undefined;
  /** Names your framework in the request's User-Agent. Default: the adapter or the runtime. */
  framework?: Framework | undefined;
  /**
   * Keys of a local or test backend, as `{ keyId: publicKey }`. Only with a custom
   * `apiUrl`: the package refuses them while `apiUrl` is the default.
   */
  publicKeys?: Readonly<Record<string, string>> | undefined;
  /** Where warnings go. Default `console.warn`; `false` silences them. */
  log?: ((message: string) => void) | false | undefined;
}

/** `marquee` scrolls (the default, from 3 badges up); `row` stands still and wraps. */
export type Layout = "marquee" | "row";

/** Options of every renderer. */
export interface WallRenderOptions {
  layout?: Layout | undefined;
  /** Extra classes for the root element. */
  className?: string | undefined;
  /** CSP nonce for the one `<style>` element. */
  nonce?: string | undefined;
}

/** A rendered element: what every framework adapter writes, one to one. */
export interface ViewNode {
  readonly tag: string;
  readonly attrs: ReadonlyArray<readonly [string, string]>;
  readonly style?: ReadonlyArray<readonly [string, string]>;
  readonly children: ReadonlyArray<ViewNode | string>;
}
