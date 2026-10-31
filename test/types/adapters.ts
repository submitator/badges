// Compile-time checks of the hand-written declarations in svelte/ and astro/
// against the built core: `npm run lint:package` runs them after the build
// (tsconfig.types.json). A type the declarations name that dist/ no longer
// exports turns into `any`, and the checks below fail.
import type {
  BadgeWall as AstroBadgeWall,
  BadgeWallProps as AstroProps,
  SubmitatorBadges,
  SubmitatorBadgesProps,
} from "../../astro/index.js";
import type { FetchWallOptions, Layout, Wall } from "../../dist/index.js";
import type {
  BadgeWall as SvelteBadgeWall,
  BadgeWallProps as SvelteProps,
} from "../../svelte/index.js";
import type { Component } from "svelte";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

export type Checks = [
  Expect<Equal<SvelteProps["wall"], Wall | null | undefined>>,
  Expect<Equal<SvelteProps["layout"], Layout | undefined>>,
  Expect<Equal<SvelteProps["class"], string | undefined>>,
  Expect<Equal<SvelteProps["nonce"], string | undefined>>,
  Expect<Equal<typeof SvelteBadgeWall, Component<SvelteProps>>>,
  Expect<Equal<AstroProps["wall"], Wall | null | undefined>>,
  Expect<Equal<AstroProps["layout"], Layout | undefined>>,
  Expect<Equal<Parameters<typeof AstroBadgeWall>[0], AstroProps>>,
  Expect<Equal<Parameters<typeof SubmitatorBadges>[0], SubmitatorBadgesProps>>,
  Expect<Equal<SubmitatorBadgesProps["project"], FetchWallOptions["project"]>>,
  Expect<SubmitatorBadgesProps extends FetchWallOptions ? true : false>,
];
