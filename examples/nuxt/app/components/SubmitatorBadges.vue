<!-- components/SubmitatorBadges.vue: render it in your homepage footer -->
<script setup lang="ts">
import { BadgeWall } from "@submitator/badges/vue";

const { data } = await useFetch("/api/submitator-badges");
</script>

<template>
  <BadgeWall v-if="data?.wall" :wall="data.wall" />
</template>
