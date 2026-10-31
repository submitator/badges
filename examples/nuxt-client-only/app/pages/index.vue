<!--
  DO NOT COPY: the wall comes from the server (it travels in the page's
  payload, with ?ref=<project id>), but ClientOnly renders it only in the
  browser. The server HTML has no badge, so directories and our checks find
  nothing, which is why the self-check looks for data-sbm-ref instead of ref=.
-->
<script setup lang="ts">
import { BadgeWall } from "@submitator/badges/vue";

const { data } = await useFetch("/api/submitator-badges");
</script>

<template>
  <main>
    <h1>Client-only render (do not copy)</h1>
  </main>
  <footer>
    <ClientOnly>
      <BadgeWall v-if="data?.wall" :wall="data.wall" />
    </ClientOnly>
  </footer>
</template>
