// A second page with the same wall. At build time it is usually served from
// the package's memory, with no request to the wall server: the page must
// still get a lifetime of 15 seconds, not stay as built until the next deploy.
import { SubmitatorBadges } from "@submitator/badges/react";

export default function About() {
  return (
    <>
      <main>
        <h1>About</h1>
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
