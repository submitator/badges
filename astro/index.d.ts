import type { FetchWallOptions, Layout, Wall } from "../dist/index.js";

/** Props of BadgeWall. */
export interface BadgeWallProps {
  /** The wall from fetchWall. null or undefined renders nothing. */
  wall: Wall | null | undefined;
  /** `marquee` (the default, from 3 badges up) or `row`. */
  layout?: Layout | undefined;
  /** Extra classes for the wall's root element. */
  class?: string | undefined;
  /** CSP nonce for the one `<style>` element. */
  nonce?: string | undefined;
}

/** Props of SubmitatorBadges: the options of fetchWall and of BadgeWall. */
export interface SubmitatorBadgesProps extends FetchWallOptions {
  /** `marquee` (the default, from 3 badges up) or `row`. */
  layout?: Layout | undefined;
  /** Extra classes for the wall's root element. */
  class?: string | undefined;
  /** CSP nonce for the one `<style>` element. */
  nonce?: string | undefined;
}

/**
 * Renders a wall: the badges in one scrolling strip (or a still row), with
 * one `<style>` element and no script. Renders nothing for a null, empty or
 * malformed wall.
 */
export declare function BadgeWall(props: BadgeWallProps): any;

/**
 * Fetches your project's wall on the server and renders it. Renders nothing
 * when there is no wall to show. Pages that Astro prerenders change only
 * when you rebuild.
 */
export declare function SubmitatorBadges(props: SubmitatorBadgesProps): any;
