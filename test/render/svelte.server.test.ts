// Server rendering of the Svelte 5 components, as SvelteKit does it.
import { render } from "svelte/server";
import { BadgeWall } from "../../svelte/index.js";
import { describeWallRendering } from "../support/render.js";

describeWallRendering({
  render: (wall, { layout, className, nonce } = {}) =>
    render(BadgeWall, { props: { wall, layout, class: className, nonce } }).body,
});
