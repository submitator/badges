// Compile-time checks of the adapters' prop types as customers see them: the
// hand-written declarations in svelte/ and astro/ and the emitted ones in
// dist/, against the built core. `npm run lint:package` runs them after the
// build (tsconfig.types.json, declaration files included).
import type {
  BadgeWall as AstroBadgeWall,
  BadgeWallProps as AstroProps,
  SubmitatorBadges,
  SubmitatorBadgesProps,
} from "../../astro/index.js";
import type { BadgeWallProps as ReactProps } from "@submitator/badges/react";
import type { BadgeWall as VueBadgeWall, BadgeWallProps as VueProps } from "@submitator/badges/vue";
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
  Expect<Equal<VueProps["wall"], Wall | null | undefined>>,
  Expect<Equal<VueProps["layout"], Layout | undefined>>,
  Expect<typeof VueBadgeWall extends new (...args: never[]) => unknown ? true : false>,
  Expect<Equal<ReactProps["wall"], Wall | null | undefined>>,
  Expect<Equal<ReactProps["className"], string | undefined>>,
];
