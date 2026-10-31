// The React snippets of the README (contract/README.snippets.md), type-checked
// as a customer's project sees them: package-name imports resolved through
// the exports map to dist/, and SubmitatorBadges, an async Server Component,
// used as JSX. lint:package runs this after the build (tsconfig.types.json).
import { fetchWall, type Wall } from "@submitator/badges";
import { BadgeWall, SubmitatorBadges } from "@submitator/badges/react";

// Next.js (App Router)
export function Home() {
  return (
    <footer>
      <SubmitatorBadges project="YOUR_PROJECT_ID" />
    </footer>
  );
}

// Next.js 16 with cacheComponents (cacheLife comes from next/cache in the snippet)
export async function Badges() {
  "use cache";
  return <SubmitatorBadges project="YOUR_PROJECT_ID" />;
}

// Next.js (Pages Router)
export async function getStaticProps() {
  return { props: { wall: await fetchWall({ project: "YOUR_PROJECT_ID" }) }, revalidate: 60 };
}

export function PagesHome({ wall }: { wall: Wall | null }) {
  return (
    <footer>
      <BadgeWall wall={wall} />
    </footer>
  );
}

// Still row, and the local backend
export function Variants() {
  return (
    <>
      <SubmitatorBadges project="YOUR_PROJECT_ID" layout="row" />
      <SubmitatorBadges
        project="YOUR_PROJECT_ID"
        apiUrl="http://localhost:3001"
        publicKeys={{ "test-rfc8032-1": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo" }}
      />
      <BadgeWall wall={null} className="footer-badges" nonce="n0nce" />
    </>
  );
}

export function Misuse() {
  return (
    <>
      {/* @ts-expect-error: layout is marquee or row */}
      <BadgeWall wall={null} layout="grid" />
      {/* @ts-expect-error: project is required */}
      <SubmitatorBadges />
    </>
  );
}
