// src/routes/+layout.server.ts (merge into your load if you have one)
// The README snippet with the local backend options: the mock wall server and
// its test key.
import { fetchWall } from "@submitator/badges";

export async function load() {
  return {
    wall: await fetchWall({
      project: "00000000-0000-4000-8000-000000000001",
      framework: "sveltekit",
      apiUrl: "http://127.0.0.1:4010",
      publicKeys: { "test-rfc8032-1": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo" },
    }),
  };
}
