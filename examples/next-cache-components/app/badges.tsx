// app/badges.tsx: render <Badges /> in your homepage footer
// The README snippet with the local backend options: the mock wall server and
// its test key.
import { cacheLife } from "next/cache";
import { SubmitatorBadges } from "@submitator/badges/react";

export async function Badges() {
  "use cache";
  cacheLife("minutes");
  return (
    <SubmitatorBadges
      project="00000000-0000-4000-8000-000000000001"
      apiUrl="http://127.0.0.1:4010"
      publicKeys={{ "test-rfc8032-1": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo" }}
    />
  );
}
