// Prints the npm dist-tag of a release: next for a prerelease (1.2.0-rc.1),
// latest otherwise. release.yml passes it to npm stage publish --tag.
//
//   node scripts/dist-tag.mjs            # the version in package.json
//   node scripts/dist-tag.mjs 1.2.0-rc.1
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function distTag(version) {
  return version.includes("-") ? "next" : "latest";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version =
    process.argv[2] ??
    JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
  console.log(distTag(version));
}
