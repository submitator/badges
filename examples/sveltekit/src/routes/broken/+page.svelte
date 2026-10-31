<script lang="ts">
  import { BadgeWall } from "@submitator/badges/svelte";

  let { data } = $props();
</script>

<main>
  <h1>Broken wall</h1>
  {#if data.brokenWall}
    <BadgeWall wall={data.brokenWall} />
  {/if}
</main>
