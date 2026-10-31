<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { BadgeWall } from "@submitator/badges/svelte";

  let { data, children } = $props();
</script>

{@render children()}

<footer>
  {#if data.wall}
    <BadgeWall wall={data.wall} />
  {/if}
</footer>
