<script>
  // A wall rendered by Svelte 5, on the server (SvelteKit) and when the page
  // hydrates. Renders nothing for a null, undefined, empty or malformed wall.
  // The template holds no whitespace. Never reformat this file.
  import { layoutWall } from "../dist/index.js";
  import Node from "./Node.svelte";

  /** @type {import("./index.js").BadgeWallProps} */
  let { wall, layout = undefined, class: className = undefined, nonce = undefined } = $props();

  const view = $derived(layoutWall(wall, { layout, className, nonce }));
</script>
{#if view}<Node node={view} />{/if}
