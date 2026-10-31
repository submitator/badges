// Checks what `npm pack` would ship:
// - only the allowed paths, and every file the exports map points at;
// - no path with a `server` segment (SvelteKit treats those as server-only);
// - no test key in shipped code;
// - every relative import of the shipped Svelte and Astro sources resolves to
//   a shipped file (they import the core as ../dist/index.js);
// - every relative link of README.md points at a shipped file, so it works in
//   node_modules (on npmjs.com such links open the GitHub repo instead).
// Run it after `npm run build`.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { posix } from "node:path";
import { pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);

/** The paths `npm pack` would ship, from `npm pack --dry-run --json`. */
export function packedPaths() {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: root,
    encoding: "utf8",
  });
  const [entry] = JSON.parse(out);
  return entry.files.map((file) => file.path).sort();
}

/** Every file an exports map points at, without the leading "./". */
export function exportTargets(exportsField) {
  const targets = new Set();
  const visit = (value) => {
    if (typeof value === "string") targets.add(value.replace(/^\.\//, ""));
    else if (value !== null && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(exportsField);
  return [...targets].sort();
}

const manifest = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
/** Documents that ship: the README links to all of them. */
const DOCS = ["README.md", "LICENSE", "CHANGELOG.md", "CONTRACT.md", "SECURITY.md"];
const ALLOWED_FILES = new Set(["package.json", ...DOCS]);
const ALLOWED_DIRS = ["dist/", "svelte/", "astro/"];
export const REQUIRED = [
  "package.json",
  ...DOCS.filter((path) => path !== "README.md"),
  ...exportTargets(manifest.exports).filter((path) => path !== "package.json"),
];
const MARKDOWN_LINK = /\]\(([^)\s]+)\)/g;

/** The links of a Markdown text that point at a file next to it (no scheme, no #anchor). */
export function relativeLinks(markdown) {
  return [...markdown.matchAll(MARKDOWN_LINK)]
    .map((match) => match[1].replace(/#.*$/, ""))
    .filter((target) => target !== "" && !/^[a-z][a-z0-9+.-]*:/i.test(target));
}

/** README links to files the tarball does not hold. */
export function readmeLinkProblems(paths, readme = readShipped("README.md")) {
  const shipped = new Set(paths);
  return relativeLinks(readme)
    .filter((target) => !shipped.has(posix.normalize(target)))
    .map((target) => `README.md links to ${target}, which is not shipped`);
}
const SERVER_SEGMENT = /(?:^|\/)server(?:[./]|$)/;
// RFC 8032 TEST 1, the public test key and its seed: never in shipped code.
const TEST_KEY_PARTS = [
  "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
  "nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A",
  "test-rfc8032-1",
];
// Component sources ship as written: their relative imports must stay inside the tarball.
const SOURCE_DIRS = ["svelte/", "astro/"];
const RELATIVE_IMPORT = /(?:\bfrom|\bimport)\s*\(?\s*["'](\.\.?\/[^"']+)["']/g;

/** The relative specifiers a source file imports, in order. */
export function relativeImports(text) {
  return [...text.matchAll(RELATIVE_IMPORT)].map((match) => match[1]);
}

/**
 * Returns the problems with a list of packed paths (empty when all is well).
 * `requireBuild: false` skips the files only a build produces.
 */
export function packProblems(paths, { requireBuild = true, read = readShipped } = {}) {
  const problems = [];
  const shipped = new Set(paths);
  for (const path of paths) {
    const inDir = ALLOWED_DIRS.some((dir) => path.startsWith(dir));
    if (!ALLOWED_FILES.has(path) && !inDir) problems.push(`not allowed in the tarball: ${path}`);
    if (SERVER_SEGMENT.test(path)) problems.push(`path has a server segment: ${path}`);
    if (!inDir) continue;
    const text = read(path);
    for (const part of TEST_KEY_PARTS) {
      if (text.includes(part)) problems.push(`test key material in ${path}`);
    }
    if (!SOURCE_DIRS.some((dir) => path.startsWith(dir))) continue;
    for (const specifier of relativeImports(text)) {
      const target = posix.normalize(posix.join(posix.dirname(path), specifier));
      if (!requireBuild && target.startsWith("dist/")) continue;
      if (!shipped.has(target)) problems.push(`${path} imports ${specifier}, which is not shipped`);
    }
  }
  const required = requireBuild ? REQUIRED : REQUIRED.filter((path) => !path.startsWith("dist/"));
  for (const path of required) {
    if (!shipped.has(path)) problems.push(`missing from the tarball: ${path}`);
  }
  return problems;
}

function readShipped(path) {
  return readFileSync(new URL(path, root), "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const paths = packedPaths();
  const problems = [...packProblems(paths), ...readmeLinkProblems(paths)];
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
  console.log("pack check: ok");
}
