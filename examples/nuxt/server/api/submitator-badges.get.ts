// server/api/submitator-badges.get.ts
// The README snippet with the local backend options: the mock wall server and
// its test key. The route returns { wall }, never a bare null (h3 would answer
// 204 with no body).
import { fetchWall } from "@submitator/badges";

export default defineEventHandler(async () => ({
  wall: await fetchWall({
    project: "00000000-0000-4000-8000-000000000001",
    framework: "nuxt",
    apiUrl: "http://127.0.0.1:4010",
    publicKeys: { "test-rfc8032-1": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo" },
  }),
}));
