// A project whose wall has a bad signature: wall is null, the page still works.
import { fetchWall, type Wall } from "@submitator/badges";
import { BadgeWall } from "@submitator/badges/react";

export async function getStaticProps() {
  const wall = await fetchWall({
    project: "00000000-0000-4000-8000-000000000002",
    apiUrl: "http://127.0.0.1:4010",
    publicKeys: { "test-rfc8032-1": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo" },
  });
  return { props: { wall }, revalidate: 60 };
}

export default function Broken({ wall }: { wall: Wall | null }) {
  return (
    <>
      <main>
        <h1>Broken wall</h1>
      </main>
      <footer>
        <BadgeWall wall={wall} />
      </footer>
    </>
  );
}
