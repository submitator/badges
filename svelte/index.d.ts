import type { Component } from "svelte";
import type { Layout, Wall } from "../dist/index.js";

/** Props of BadgeWall. */
export interface BadgeWallProps {
  /** The wall from fetchWall (return it from your load function). null or undefined renders nothing. */
  wall: Wall | null | undefined;
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
export declare const BadgeWall: Component<BadgeWallProps>;
