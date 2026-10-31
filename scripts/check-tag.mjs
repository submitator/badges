// Fails unless the pushed tag names the version being released: the tag is
// v + package.json's version, src/version.ts says the same, and the version is
// one our server reads (check-version.mjs). release.yml runs it first.
//
//   node scripts/check-tag.mjs v1.2.3
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { SERVER_VERSION, SERVER_VERSION_RULE } from "./check-version.mjs";

const TAG = new RegExp(`^v(${SERVER_VERSION})$`);

/** The problems with releasing `tag` (empty when there are none). */
export function tagProblems(tag, packageVersion, sourceVersion) {
  const problems = [];
  const match = TAG.exec(tag ?? "");
  if (match === null) {
    problems.push(
      `"${tag}" is not a release tag: v + a version our server reads, ${SERVER_VERSION_RULE}`,
    );
  } else if (match[1] !== packageVersion) {
    problems.push(`the tag says ${match[1]}, package.json says ${packageVersion}`);
  }
  if (sourceVersion !== packageVersion) {
    problems.push(`src/version.ts says ${sourceVersion}, package.json says ${packageVersion}`);
  }
  return problems;
}

/** VERSION as written in src/version.ts. */
export function sourceVersion(text) {
  return /export const VERSION: string = "([^"]*)";/.exec(text)?.[1] ?? null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = new URL("../", import.meta.url);
  const { version } = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
  const source = sourceVersion(readFileSync(new URL("src/version.ts", root), "utf8"));
  const problems = tagProblems(process.argv[2], version, source);
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) process.exit(1);
  console.log(`tag check: v${version}`);
}
