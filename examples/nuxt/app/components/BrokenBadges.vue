<script setup lang="ts">
import { BadgeWall } from "@submitator/badges/vue";

const { data } = await useFetch("/api/broken-badges");
</script>

<template>
  <BadgeWall v-if="data?.wall" :wall="data.wall" />
</template>
