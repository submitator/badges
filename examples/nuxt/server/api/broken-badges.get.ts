// A project whose wall has a bad signature: { wall: null }, and the page still works.
import { fetchWall } from "@submitator/badges";

export default defineEventHandler(async () => ({
  wall: await fetchWall({
    project: "00000000-0000-4000-8000-000000000002",
    framework: "nuxt",
    apiUrl: "http://127.0.0.1:4010",
    publicKeys: { "test-rfc8032-1": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo" },
  }),
}));
