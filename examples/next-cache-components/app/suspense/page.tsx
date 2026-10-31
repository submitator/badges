// The other way: no cache, the wall renders on every request and streams in.
// The anchors still reach the HTML (in a hidden element a script moves into
// place), so checkers that read the raw HTML find them.
import { Suspense } from "react";
import { SubmitatorBadges } from "@submitator/badges/react";

export default function SuspensePage() {
  return (
    <>
      <main>
        <h1>The wall inside Suspense</h1>
      </main>
      <footer>
        <Suspense fallback={null}>
          <SubmitatorBadges
            project="00000000-0000-4000-8000-000000000001"
            apiUrl="http://127.0.0.1:4010"
            publicKeys={{ "test-rfc8032-1": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo" }}
          />
        </Suspense>
      </footer>
    </>
  );
}
