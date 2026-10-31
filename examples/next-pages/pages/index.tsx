// pages/index.tsx
// The README snippet with the local backend options: the mock wall server and
// its test key.
import { fetchWall, type Wall } from "@submitator/badges";
import { BadgeWall } from "@submitator/badges/react";

export async function getStaticProps() {
  const wall = await fetchWall({
    project: "00000000-0000-4000-8000-000000000001",
    apiUrl: "http://127.0.0.1:4010",
    publicKeys: { "test-rfc8032-1": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo" },
  });
  return { props: { wall }, revalidate: 60 };
}

export default function Home({ wall }: { wall: Wall | null }) {
  return (
    <>
      <main>
        <h1>Next.js Pages Router example</h1>
      </main>
      <footer>
        <BadgeWall wall={wall} />
      </footer>
    </>
  );
}
