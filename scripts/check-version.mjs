// Fails unless package.json's version is one our server reads: the version
// grammar of its User-Agent pattern (CONTRACT.md section 9). The server never
// records the installs of any other version. npm publish and npm stage publish
// run it first (prepublishOnly), and check-tag.mjs holds tags to the same grammar.
//
//   node scripts/check-version.mjs
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** The version of the server's User-Agent pattern, without anchors. */
export const SERVER_VERSION = String.raw`\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z.]{1,20})?`;

/** What SERVER_VERSION allows, for the error messages. */
export const SERVER_VERSION_RULE =
  "at most 4 digits a part, and a prerelease of at most 20 letters, digits and dots (1.2.0-rc.1, not 1.2.0-rc-1), with no build metadata";

const VERSION = new RegExp(`^${SERVER_VERSION}$`);

/** The problems with releasing `version` (empty when there are none). */
export function versionProblems(version) {
  if (VERSION.test(version ?? "")) return [];
  return [`"${version}" is not a version our server reads: ${SERVER_VERSION_RULE}`];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  const problems = versionProblems(version);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`package.json: ${problem}`);
    process.exit(1);
  }
  console.log(`version check: ${version}`);
}
