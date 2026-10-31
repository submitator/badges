// The wall is fetched on the server, then handed to a client component that
// renders it only after the page has loaded in the browser.
import { fetchWall } from "@submitator/badges";
import { ClientBadges } from "./client-badges";

export default async function Home() {
  const wall = await fetchWall({
    project: "00000000-0000-4000-8000-000000000001",
    apiUrl: "http://127.0.0.1:4010",
    publicKeys: { "test-rfc8032-1": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo" },
  });
  return (
    <>
      <main>
        <h1>Client-only render (do not copy)</h1>
      </main>
      <footer>
        <ClientBadges wall={wall} />
      </footer>
    </>
  );
}
