// Prints the CHANGELOG.md section of a version (its lines under "## <version>"
// up to the next "## " heading), for the GitHub release notes. Fails when the
// section is missing or empty: move the Unreleased entries first.
//
//   node scripts/changelog-section.mjs 1.2.3
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** The section's text, trimmed, or null when there is none. */
export function changelogSection(changelog, version) {
  const lines = changelog.split("\n");
  const heading = new RegExp(`^## \\[?${version.replaceAll(".", "\\.")}\\]?(?:\\s|$)`);
  const start = lines.findIndex((line) => heading.test(line));
  if (start < 0) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  const text = (end < 0 ? rest : rest.slice(0, end)).join("\n").trim();
  return text === "" ? null : text;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = process.argv[2];
  const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
  const section = version === undefined ? null : changelogSection(changelog, version);
  if (section === null) {
    console.error(
      `CHANGELOG.md has no section for ${version}: move the Unreleased entries under it`,
    );
    process.exit(1);
  }
  console.log(section);
}
