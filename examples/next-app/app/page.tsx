// app/page.tsx: your homepage, a Server Component (no "use client")
// The README snippet with the local backend options: the mock wall server and
// its test key. revalidate={15} lets the example check the page's lifetime.
import { SubmitatorBadges } from "@submitator/badges/react";

export default function Home() {
  return (
    <>
      <main>
        <h1>Next.js App Router example</h1>
      </main>
      <footer>
        <SubmitatorBadges
          project="00000000-0000-4000-8000-000000000001"
          apiUrl="http://127.0.0.1:4010"
          publicKeys={{ "test-rfc8032-1": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo" }}
          revalidate={15}
        />
      </footer>
    </>
  );
}
