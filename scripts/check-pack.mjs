// Checks what `npm pack` would ship: only the allowed paths, the files every
// install needs, no path with a `server` segment (SvelteKit treats those as
// server-only) and no test key in shipped code. Run it after `npm run build`.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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

const ALLOWED_FILES = new Set(["package.json", "README.md", "LICENSE", "CHANGELOG.md"]);
const ALLOWED_DIRS = ["dist/", "svelte/", "astro/"];
export const REQUIRED = [
  "package.json",
  "LICENSE",
  "CHANGELOG.md",
  "dist/index.js",
  "dist/index.d.ts",
];
const SERVER_SEGMENT = /(?:^|\/)server(?:[./]|$)/;
// RFC 8032 TEST 1, the public test key and its seed: never in shipped code.
const TEST_KEY_PARTS = [
  "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo",
  "nWGxne_9WmC6hEr0kuwsxERJxWl7MmkZcDusAxyuf2A",
  "test-rfc8032-1",
];

/**
 * Returns the problems with a list of packed paths (empty when all is well).
 * `requireBuild: false` skips the files only a build produces.
 */
export function packProblems(paths, { requireBuild = true, read = readShipped } = {}) {
  const problems = [];
  for (const path of paths) {
    const inDir = ALLOWED_DIRS.some((dir) => path.startsWith(dir));
    if (!ALLOWED_FILES.has(path) && !inDir) problems.push(`not allowed in the tarball: ${path}`);
    if (SERVER_SEGMENT.test(path)) problems.push(`path has a server segment: ${path}`);
    if (inDir) {
      const text = read(path);
      for (const part of TEST_KEY_PARTS) {
        if (text.includes(part)) problems.push(`test key material in ${path}`);
      }
    }
  }
  const required = requireBuild ? REQUIRED : REQUIRED.filter((path) => !path.startsWith("dist/"));
  for (const path of required) {
    if (!paths.includes(path)) problems.push(`missing from the tarball: ${path}`);
  }
  return problems;
}

function readShipped(path) {
  return readFileSync(new URL(path, root), "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const problems = packProblems(packedPaths());
  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    process.exit(1);
  }
  console.log("pack check: ok");
}
