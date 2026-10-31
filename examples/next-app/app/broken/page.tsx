// A project whose wall has a bad signature: no badges, and the page still works.
import { SubmitatorBadges } from "@submitator/badges/react";

export default function Broken() {
  return (
    <>
      <main>
        <h1>Broken wall</h1>
      </main>
      <footer>
        <SubmitatorBadges
          project="00000000-0000-4000-8000-000000000002"
          apiUrl="http://127.0.0.1:4010"
          publicKeys={{ "test-rfc8032-1": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo" }}
        />
      </footer>
    </>
  );
}
