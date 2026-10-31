// The one stylesheet of a wall, scoped under `.sbm-wall`.
// - Motion is CSS only: it pauses on hover and on keyboard focus.
// - Under reduced motion and in print the strip stands still, wraps every
//   badge onto rows and hides the loop copy and the fill items.
// - `contain: paint` keeps every badge inside the strip, whatever its styles.
// - It holds none of < > & " ' so every framework writes it byte for byte.
// Public knobs: --sbm-wall-gap (16px) and --sbm-wall-duration.

/** Class names the package owns (distinct from the app's older sbm-badges snippet). */
export const CLASS: {
  readonly root: "sbm-wall";
  readonly marquee: "sbm-wall-marquee";
  readonly row: "sbm-wall-row";
  readonly track: "sbm-wall-track";
  readonly list: "sbm-wall-list";
  readonly item: "sbm-wall-item";
  readonly copy: "sbm-wall-copy";
  readonly fill: "sbm-wall-fill";
} = Object.freeze({
  root: "sbm-wall",
  marquee: "sbm-wall-marquee",
  row: "sbm-wall-row",
  track: "sbm-wall-track",
  list: "sbm-wall-list",
  item: "sbm-wall-item",
  copy: "sbm-wall-copy",
  fill: "sbm-wall-fill",
});

/** The class of the wrapper around custom badges; the directory badge check skips it. */
export const CUSTOM_BADGE_CLASS = "sbm-cb";

export const CSS: string = [
  ".sbm-wall{position:relative;display:block;box-sizing:border-box;width:100%;max-width:100%;overflow:hidden;contain:paint;isolation:isolate;direction:ltr;--sbm-wall-gap:16px}",
  ".sbm-wall .sbm-wall-track{display:flex;width:max-content;animation:sbm-wall-scroll var(--sbm-wall-duration,40s) linear infinite;will-change:transform}",
  ".sbm-wall .sbm-wall-list{display:flex;flex:none;align-items:center;margin:0;padding:6px 4px;list-style:none}",
  ".sbm-wall .sbm-wall-item{display:flex;flex:none;align-items:center;margin:0 var(--sbm-wall-gap) 0 0;padding:0;list-style:none}",
  ".sbm-wall-marquee .sbm-wall-item img{max-width:none}",
  ".sbm-wall:hover .sbm-wall-track,.sbm-wall:focus-within .sbm-wall-track{animation-play-state:paused}",
  "@keyframes sbm-wall-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}",
  ".sbm-wall-row .sbm-wall-list{flex-wrap:wrap;row-gap:var(--sbm-wall-gap)}",
  "@media print,(prefers-reduced-motion:reduce){.sbm-wall .sbm-wall-track{display:block;width:auto;animation:none}.sbm-wall .sbm-wall-list{flex-wrap:wrap;row-gap:var(--sbm-wall-gap)}.sbm-wall .sbm-wall-copy,.sbm-wall .sbm-wall-fill{display:none}}",
].join("");
